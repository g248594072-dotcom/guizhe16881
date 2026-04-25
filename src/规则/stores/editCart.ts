import { defineStore } from 'pinia';
import { klona } from 'klona';
import { ref, computed } from 'vue';
import type { EditCartItem } from '../types/editCart';
import { useDataStore } from '../store';
import { applyEditCartAction } from '../utils/editCartApply';
import { appendPendingUpdateVariablePatches } from '../utils/pendingUpdateVariableQueue';
import { diffValueToJsonPatches } from '../utils/tacticalMapCommitSendBox';
import { buildStagingHintsFromCartItems } from '../utils/stagingChangeHint';

const CAT_ORDER = ['world', 'region', 'character', 'personal', 'avatar'] as const;

export const useEditCartStore = defineStore('ruleEditCart', () => {
  const items = ref<EditCartItem[]>([]);

  const pendingCount = computed(() => items.value.length);

  function addOrReplaceItem(item: EditCartItem) {
    const i = items.value.findIndex(x => x.dedupeKey === item.dedupeKey);
    if (i >= 0) {
      items.value.splice(i, 1, item);
    } else {
      items.value.push(item);
    }
  }

  /** 编辑后写回：先移除原 id，再按 dedupeKey 合并（与同键覆盖策略一致） */
  function replaceItemAfterEdit(item: EditCartItem) {
    items.value = items.value.filter(x => x.id !== item.id);
    addOrReplaceItem(item);
  }

  function removeItem(id: string) {
    items.value = items.value.filter(x => x.id !== id);
  }

  function clear() {
    items.value = [];
  }

  function sortedItems(): EditCartItem[] {
    const buckets = new Map<string, EditCartItem[]>();
    for (const c of CAT_ORDER) {
      buckets.set(c, []);
    }
    for (const it of items.value) {
      buckets.get(it.category)?.push(it);
    }
    return CAT_ORDER.flatMap(c => buckets.get(c) ?? []);
  }

  /**
   * 按分区顺序执行；全部成功后清空购物车，合并说明经 App 的 copyToInput（写入输入框或待发变量块摘要）。
   * 中途失败：已执行项已从购物车移除，未执行项保留。
   */
  async function applyAll(copyToInput: (text: string, mode: 'append' | 'replace') => void): Promise<boolean> {
    const list = sortedItems();
    const hintText = buildStagingHintsFromCartItems(list);
    const store = useDataStore();
    const dialogChunks: string[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const beforeItem = klona(store.data);
        const msg = await applyEditCartAction(list[i].action);
        const m = String(msg ?? '').trim();
        if (m) dialogChunks.push(m);
        const itemPatches = diffValueToJsonPatches('', beforeItem, klona(store.data));
        if (itemPatches.length > 0) {
          appendPendingUpdateVariablePatches(itemPatches);
        }
      } catch (e) {
        console.error('[editCart] applyAll 在第', i + 1, '项失败:', e);
        const keepIds = new Set(list.slice(i).map(x => x.id));
        items.value = items.value.filter(x => keepIds.has(x.id));
        toastr.error(`批量提交在第 ${i + 1} 项失败：${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    }
    const drafted = dialogChunks.join('\n\n').trim();
    const hint = hintText.trim();
    const body = [drafted, hint].filter(Boolean).join('\n\n');
    if (body) {
      copyToInput(body, 'append');
    }
    clear();
    return true;
  }

  return {
    items,
    pendingCount,
    addOrReplaceItem,
    replaceItemAfterEdit,
    removeItem,
    clear,
    sortedItems,
    applyAll,
  };
});

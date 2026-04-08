import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EditCartItem } from '../types/editCart';
import { applyEditCartAction } from '../utils/editCartApply';

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
   * 按分区顺序执行；全部成功后清空购物车并合并说明写入输入框。
   * 中途失败：已执行项已从购物车移除，未执行项保留。
   */
  async function applyAll(copyToInput: (text: string, mode: 'append' | 'replace') => void): Promise<boolean> {
    const list = sortedItems();
    const fragments: string[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const t = (await applyEditCartAction(list[i].action)).trim();
        if (t) {
          fragments.push(t);
        }
      } catch (e) {
        console.error('[editCart] applyAll 在第', i + 1, '项失败:', e);
        const keepIds = new Set(list.slice(i).map(x => x.id));
        items.value = items.value.filter(x => keepIds.has(x.id));
        toastr.error(`批量提交在第 ${i + 1} 项失败：${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    }
    clear();
    if (fragments.length > 0) {
      copyToInput(fragments.join('\n\n---\n\n'), 'append');
    }
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

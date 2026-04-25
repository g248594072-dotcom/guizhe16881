import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CompanionCandidateRecord } from '../utils/characterRecruitFromAi';

export type RecruitTab = 'input' | 'select';
export type RecruitPhase = 'brief' | 'picking';

/** 招募弹窗草稿与选人状态（关弹窗不丢；成功复制后 clear） */
export const useRecruitWizardStore = defineStore('ruleRecruitWizard', () => {
  const addCharacterName = ref('');
  const addCharacterRelationIdentity = ref('');
  const addCharacterDescription = ref('');

  const recruitTab = ref<RecruitTab>('input');
  const phase = ref<RecruitPhase>('brief');

  const candidates = ref<CompanionCandidateRecord[]>([]);
  const selectedIndices = ref<number[]>([]);
  const lastRaw = ref('');
  const genError = ref('');

  const genInFlight = ref(false);
  /** 每次发起生成 +1；完成时若与本地捕获不一致则丢弃结果 */
  const genRequestId = ref(0);

  function clear() {
    addCharacterName.value = '';
    addCharacterRelationIdentity.value = '';
    addCharacterDescription.value = '';
    recruitTab.value = 'input';
    phase.value = 'brief';
    candidates.value = [];
    selectedIndices.value = [];
    lastRaw.value = '';
    genError.value = '';
    genInFlight.value = false;
    genRequestId.value = 0;
  }

  /** 将草稿写回 modalForm（与其它弹窗字段并存） */
  function applyDraftToModalForm(target: {
    addCharacterRelationIdentity: string;
    addCharacterDescription: string;
    addCharacterName: string;
  }) {
    target.addCharacterName = addCharacterName.value;
    target.addCharacterRelationIdentity = addCharacterRelationIdentity.value;
    target.addCharacterDescription = addCharacterDescription.value;
  }

  /** 从 modalForm 拉取草稿（打开其它类型弹窗后仍可能需对齐时调用） */
  function captureDraftFromModalForm(source: {
    addCharacterRelationIdentity?: string;
    addCharacterDescription?: string;
    addCharacterName?: string;
  }) {
    addCharacterName.value = String(source.addCharacterName ?? '');
    addCharacterRelationIdentity.value = String(source.addCharacterRelationIdentity ?? '');
    addCharacterDescription.value = String(source.addCharacterDescription ?? '');
  }

  function setPhaseBrief() {
    phase.value = 'brief';
    recruitTab.value = 'input';
    genError.value = '';
  }

  function toggleSelection(idx: number, checked: boolean, maxSelection: number): boolean {
    const cur = [...selectedIndices.value];
    if (checked) {
      if (cur.includes(idx)) return true;
      if (cur.length >= maxSelection) return false;
      cur.push(idx);
      selectedIndices.value = cur.sort((a, b) => a - b);
    } else {
      selectedIndices.value = cur.filter(i => i !== idx);
    }
    return true;
  }

  return {
    addCharacterName,
    addCharacterRelationIdentity,
    addCharacterDescription,
    recruitTab,
    phase,
    candidates,
    selectedIndices,
    lastRaw,
    genError,
    genInFlight,
    genRequestId,
    clear,
    applyDraftToModalForm,
    captureDraftFromModalForm,
    setPhaseBrief,
    toggleSelection,
  };
});

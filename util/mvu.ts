import { StoreDefinition } from 'pinia';
import { sanitizeStatDataRoleArchivesNestedMaps } from '@/规则/utils/tagMap';

/** 从变量表中取出 MVU stat_data（单层；遇双层嵌套则取内层） */
export function extractMvuStatData(variables: any): Record<string, unknown> {
  if (!variables) return {};
  if (variables.stat_data && typeof variables.stat_data === 'object') {
    if (
      variables.stat_data.stat_data &&
      typeof variables.stat_data.stat_data === 'object'
    ) {
      console.warn('[mvu] 检测到双重嵌套，自动平展');
      return variables.stat_data.stat_data as Record<string, unknown>;
    }
    return variables.stat_data as Record<string, unknown>;
  }
  return {};
}

/**
 * 合并「游戏时间」后再交给 schema：
 * - 开局完整对象写在 **message_id: 0**，AI 对最新层的 patch 往往只带锚点「年」与月日时分，纪元字段会丢。
 * - 绑定 **最新层**（message_id: -1）时：先铺 **0 层** 的 `游戏时间`，再叠 **角色卡**，最后叠 **当前层**（后者覆盖前者同名字段）。
 * - 历史楼层 iframe：不读 0 层，仅尝试 **角色卡 → 当前层**，避免把当前剧本的纪元套进旧快照。
 */
/**
 * 合并「区域数据 / 建筑数据 / 活动数据 / 角色档案」的 record 层后再交给 schema：
 * - 剧情层消息上的 stat_data 往往只有 ID 引用或小 patch，**词典式定义**常在角色卡或第 0 层消息。
 * - 绑定 **message** 时：先铺 **角色卡**，再（仅最新层时）铺 **0 层**，最后叠 **当前层**（同 id 后者覆盖前者）。
 * - 历史楼层：仅 **角色卡 → 当前层**，不把 0 层套进旧快照（与 `游戏时间` 分支一致）。
 */
export function mergeMessageRefRecordsWithCharacterAndMaybeMessage0(
  statData: Record<string, unknown>,
  option: VariableOption,
): Record<string, unknown> {
  if (option.type !== 'message') return statData;

  const mid =
    option.message_id === undefined || option.message_id === 'latest'
      ? -1
      : option.message_id;

  const mergeKeys = ['区域数据', '建筑数据', '活动数据', '角色档案'] as const;

  function shallowMergeRecordLayers(...layers: unknown[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const layer of layers) {
      if (layer == null || typeof layer !== 'object' || Array.isArray(layer)) continue;
      Object.assign(out, layer as Record<string, unknown>);
    }
    return out;
  }

  const layersFromChar: unknown[] = [];
  try {
    const charVariables = getVariables({ type: 'character' });
    const charSd = sanitizeStatDataRoleArchivesNestedMaps(extractMvuStatData(charVariables)) as Record<
      string,
      unknown
    >;
    layersFromChar.push(charSd);
  } catch {
    /* 未打开角色卡等 */
  }

  const layersFrom0: unknown[] = [];
  if (mid === -1) {
    try {
      const v0 = getVariables({ type: 'message', message_id: 0 });
      const sd0 = sanitizeStatDataRoleArchivesNestedMaps(extractMvuStatData(v0)) as Record<string, unknown>;
      layersFrom0.push(sd0);
    } catch {
      /* 0 层可能尚未存在 */
    }
  }

  let changed = false;
  const out = { ...statData };
  for (const key of mergeKeys) {
    const merged = shallowMergeRecordLayers(
      ...layersFromChar.map(sd => (sd as Record<string, unknown>)?.[key]),
      ...layersFrom0.map(sd => (sd as Record<string, unknown>)?.[key]),
      statData[key],
    );
    const prev = statData[key];
    if (Object.keys(merged).length === 0 && (prev == null || prev === undefined)) {
      continue;
    }
    if (!_.isEqual(prev, merged)) {
      (out as Record<string, unknown>)[key] = merged;
      changed = true;
    }
  }
  return changed ? out : statData;
}

function mergeMessageGameTimeWithCharacter(
  statData: Record<string, unknown>,
  option: VariableOption,
): Record<string, unknown> {
  if (option.type !== 'message') return statData;

  const mid =
    option.message_id === undefined || option.message_id === 'latest'
      ? -1
      : option.message_id;

  let base: Record<string, unknown> = {};

  if (mid === -1) {
    try {
      const v0 = getVariables({ type: 'message', message_id: 0 });
      const sd0 = sanitizeStatDataRoleArchivesNestedMaps(extractMvuStatData(v0)) as Record<string, unknown>;
      const g0 = sd0['游戏时间'];
      if (g0 != null && typeof g0 === 'object' && !Array.isArray(g0)) {
        base = { ...(g0 as Record<string, unknown>) };
      }
    } catch {
      /* 0 层可能尚未存在 */
    }
  }

  try {
    const charVariables = getVariables({ type: 'character' });
    const charSd = sanitizeStatDataRoleArchivesNestedMaps(extractMvuStatData(charVariables)) as Record<
      string,
      unknown
    >;
    const cGt = charSd['游戏时间'];
    if (cGt != null && typeof cGt === 'object' && !Array.isArray(cGt)) {
      base = { ...base, ...(cGt as Record<string, unknown>) };
    }
  } catch {
    /* 未打开角色卡等 */
  }

  const mGt = statData['游戏时间'];
  const mergedGt =
    mGt == null || typeof mGt !== 'object' || Array.isArray(mGt)
      ? Object.keys(base).length > 0
        ? base
        : ((mGt ?? {}) as Record<string, unknown>)
      : { ...base, ...(mGt as Record<string, unknown>) };

  if (_.isEqual(mergedGt, mGt)) return statData;
  return { ...statData, 游戏时间: mergedGt };
}

function normalizeMessageVariableOption(option: VariableOption): VariableOption {
  const o = _.cloneDeep(option);
  if (
    o.type === 'message' &&
    (o.message_id === undefined || o.message_id === 'latest')
  ) {
    o.message_id = -1;
  }
  return o;
}

export type DefineMvuDataStoreOptions = {
  /**
   * 为 false 时：仍从 variable_option 拉取/轮询合并到本地 `data`，但不调用 `updateVariablesWith` 写回酒馆。
   * 用于历史楼层 iframe 只读快照，避免与 `message_id: -1` 争用。默认 true。
   */
  writeBack?: boolean;
};

/**
 * @param variable_option 传入对象时与原先行为一致；传入 **函数** 时，在 Pinia store **首次初始化**（首次 `useDataStore()`）时再求值，
 * 用于 `getCurrentMessageId()` 等必须在 iframe 与楼层绑定就绪后才能调用的场景（避免在 `store.ts` 模块顶层求值读到错误楼层）。
 */
export function defineMvuDataStore<T extends z.ZodObject>(
  schema: T,
  variable_option: VariableOption | (() => VariableOption),
  additional_setup?: (data: Ref<z.infer<T>>) => void,
  store_opts?: DefineMvuDataStoreOptions | (() => DefineMvuDataStoreOptions),
): StoreDefinition<`mvu_data.${string}`, { data: Ref<z.infer<T>> }> {
  const isDeferredOption = typeof variable_option === 'function';
  const storeId = isDeferredOption
    ? `mvu_data.message.__iframe_current__`
    : `mvu_data.${_(variable_option as VariableOption)
        .entries()
        .sortBy(entry => entry[0])
        .map(entry => entry[1])
        .join('.')}`;

  return defineStore(
    storeId as `mvu_data.${string}`,
    errorCatched(() => {
      const resolvedOption = normalizeMessageVariableOption(
        isDeferredOption
          ? (variable_option as () => VariableOption)()
          : (variable_option as VariableOption),
      );
      const resolvedStoreOpts =
        typeof store_opts === 'function'
          ? (store_opts as () => DefineMvuDataStoreOptions)()
          : store_opts;
      const writeBack = resolvedStoreOpts?.writeBack !== false;
      function getStatData(variables: any): Record<string, unknown> {
        return extractMvuStatData(variables);
      }

      // 辅助函数：设置 stat_data，统一使用 MVU 格式，修复双重嵌套。
      // 在 `stat_data` / `display_data` / `delta_data` 之外合并保留消息楼层变量上的其它顶层键（如 schema、initialized_lorebooks），避免写回时整表被裁成只剩三块。
      function setStatData(variables: any, newData: any): any {
        if (!variables) variables = {};

        // 检测并修复现有的双重嵌套
        if (variables.stat_data && typeof variables.stat_data === 'object' &&
            variables.stat_data.stat_data && typeof variables.stat_data.stat_data === 'object') {
          console.warn('[mvu] 写入时检测到双重嵌套，自动修复');
          const displayData = variables.stat_data.display_data || {};
          const deltaData = variables.stat_data.delta_data || {};
          return {
            ...variables,
            stat_data: newData,
            display_data: displayData,
            delta_data: deltaData,
          };
        }

        const displayData = variables.display_data || {};
        const deltaData = variables.delta_data || {};
        return {
          ...variables,
          stat_data: newData,
          display_data: displayData,
          delta_data: deltaData,
        };
      }

      const rawVariables = getVariables(resolvedOption);
      let statData = sanitizeStatDataRoleArchivesNestedMaps(getStatData(rawVariables)) as Record<string, unknown>;
      statData = mergeMessageRefRecordsWithCharacterAndMaybeMessage0(statData, resolvedOption);
      statData = mergeMessageGameTimeWithCharacter(statData, resolvedOption);
      const data = ref(
        schema.parse(statData, { reportInput: true }),
      ) as Ref<z.infer<T>>;
      if (additional_setup) {
        additional_setup(data);
      }

      useIntervalFn(() => {
        const variables = getVariables(resolvedOption);
        const rawStatData = getStatData(variables);
        const sanitizedOnly = sanitizeStatDataRoleArchivesNestedMaps(rawStatData) as Record<string, unknown>;
        const hadCorruption = !_.isEqual(rawStatData, sanitizedOnly);
        let stat_data = mergeMessageRefRecordsWithCharacterAndMaybeMessage0(sanitizedOnly, resolvedOption);
        stat_data = mergeMessageGameTimeWithCharacter(stat_data, resolvedOption);
        const result = schema.safeParse(stat_data);
        if (result.error) {
          return;
        }
        if (!_.isEqual(data.value, result.data)) {
          ignoreUpdates(() => {
            data.value = result.data;
          });
          if (
            writeBack &&
            (!_.isEqual(stat_data, result.data) || hadCorruption)
          ) {
            updateVariablesWith(variables => setStatData(variables, result.data), resolvedOption);
          }
        } else if (hadCorruption && writeBack) {
          console.warn('[mvu] 检测到嵌套对象污染 ([object Object])，强制写回修复');
          updateVariablesWith(variables => setStatData(variables, result.data), resolvedOption);
        } else if (hadCorruption && !writeBack) {
          console.warn('[mvu] 检测到嵌套对象污染，但 writeBack=false 跳过写回');
        }
      }, 2000);

      const { ignoreUpdates } = watchIgnorable(
        data,
        new_data => {
          const result = schema.safeParse(new_data);
          if (result.error) {
            return;
          }
          if (!_.isEqual(new_data, result.data)) {
            ignoreUpdates(() => {
              data.value = result.data;
            });
          }
          if (writeBack) {
            updateVariablesWith(variables => setStatData(variables, result.data), resolvedOption);
          }
        },
        { deep: true },
      );

      return { data };
    }),
  );
}

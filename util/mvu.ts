import { StoreDefinition } from 'pinia';
import { sanitizeStatDataRoleArchivesNestedMaps } from '@/规则/utils/tagMap';

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
      // 辅助函数：获取 stat_data，统一使用 MVU 格式，检测并修复双重嵌套
      function getStatData(variables: any): any {
        if (!variables) return {};

        // 检查是否是 MVU 格式（有 stat_data 字段）
        if (variables.stat_data && typeof variables.stat_data === 'object') {
          // 检测双重嵌套：stat_data 里面还有 stat_data
          if (variables.stat_data.stat_data && typeof variables.stat_data.stat_data === 'object') {
            console.warn('[mvu] 检测到双重嵌套，自动平展');
            // 使用内层 stat_data（实际数据）
            return variables.stat_data.stat_data;
          }

          // 单层 MVU 格式，正常返回 stat_data
          return variables.stat_data;
        }

        // 不是 MVU 格式（可能是空对象或纯数据），返回空对象
        // 统一要求 MVU 格式
        return {};
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
      const statData = sanitizeStatDataRoleArchivesNestedMaps(getStatData(rawVariables)) as Record<string, unknown>;
      const data = ref(
        schema.parse(statData, { reportInput: true }),
      ) as Ref<z.infer<T>>;
      if (additional_setup) {
        additional_setup(data);
      }

      useIntervalFn(() => {
        const variables = getVariables(resolvedOption);
        const rawStatData = getStatData(variables);
        const stat_data = sanitizeStatDataRoleArchivesNestedMaps(rawStatData) as Record<string, unknown>;
        const hadCorruption = !_.isEqual(rawStatData, stat_data);
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

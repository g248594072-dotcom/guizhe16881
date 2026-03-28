import { StoreDefinition } from 'pinia';

<<<<<<< HEAD
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

/**
 * @param variable_option 传入对象时与原先行为一致；传入 **函数** 时，在 Pinia store **首次初始化**（首次 `useDataStore()`）时再求值，
 * 用于 `getCurrentMessageId()` 等必须在 iframe 与楼层绑定就绪后才能调用的场景（避免在 `store.ts` 模块顶层求值读到错误楼层）。
 */
export function defineMvuDataStore<T extends z.ZodObject>(
  schema: T,
  variable_option: VariableOption | (() => VariableOption),
  additional_setup?: (data: Ref<z.infer<T>>) => void,
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

      // 辅助函数：设置 stat_data，统一使用 MVU 格式，修复双重嵌套
      function setStatData(variables: any, newData: any): any {
        if (!variables) variables = {};

        // 检测并修复现有的双重嵌套
        if (variables.stat_data && typeof variables.stat_data === 'object' &&
            variables.stat_data.stat_data && typeof variables.stat_data.stat_data === 'object') {
          console.warn('[mvu] 写入时检测到双重嵌套，自动修复');
          // 重建正确的单层 MVU 格式
          const displayData = variables.stat_data.display_data || {};
          const deltaData = variables.stat_data.delta_data || {};
          return {
            stat_data: newData,
            display_data: displayData,
            delta_data: deltaData,
          };
        }

        // 统一使用 MVU 格式（单层）
        // 如果已经有 display_data/delta_data，保留它们
        const displayData = variables.display_data || {};
        const deltaData = variables.delta_data || {};
        return {
          stat_data: newData,
          display_data: displayData,
          delta_data: deltaData,
        };
      }

      const rawVariables = getVariables(resolvedOption);
      const statData = getStatData(rawVariables);
      const data = ref(
        schema.parse(statData, { reportInput: true }),
=======
export function defineMvuDataStore<T extends z.ZodObject>(
  schema: T,
  variable_option: VariableOption,
  additional_setup?: (data: Ref<z.infer<T>>) => void,
): StoreDefinition<`mvu_data.${string}`, { data: Ref<z.infer<T>> }> {
  if (
    variable_option.type === 'message' &&
    (variable_option.message_id === undefined || variable_option.message_id === 'latest')
  ) {
    variable_option.message_id = -1;
  }

  return defineStore(
    `mvu_data.${_(variable_option)
      .entries()
      .sortBy(entry => entry[0])
      .map(entry => entry[1])
      .join('.')}`,
    errorCatched(() => {
      const data = ref(
        schema.parse(_.get(getVariables(variable_option), 'stat_data', {}), { reportInput: true }),
>>>>>>> 859af7880ccfb04e96c9f301866693c2fac6de48
      ) as Ref<z.infer<T>>;
      if (additional_setup) {
        additional_setup(data);
      }

      useIntervalFn(() => {
<<<<<<< HEAD
        const variables = getVariables(resolvedOption);
        const stat_data = getStatData(variables);
=======
        const stat_data = _.get(getVariables(variable_option), 'stat_data', {});
>>>>>>> 859af7880ccfb04e96c9f301866693c2fac6de48
        const result = schema.safeParse(stat_data);
        if (result.error) {
          return;
        }
        if (!_.isEqual(data.value, result.data)) {
          ignoreUpdates(() => {
            data.value = result.data;
          });
          if (!_.isEqual(stat_data, result.data)) {
<<<<<<< HEAD
            updateVariablesWith(variables => setStatData(variables, result.data), resolvedOption);
=======
            updateVariablesWith(variables => _.set(variables, 'stat_data', result.data), variable_option);
>>>>>>> 859af7880ccfb04e96c9f301866693c2fac6de48
          }
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
<<<<<<< HEAD
          updateVariablesWith(variables => setStatData(variables, result.data), resolvedOption);
=======
          updateVariablesWith(variables => _.set(variables, 'stat_data', result.data), variable_option);
>>>>>>> 859af7880ccfb04e96c9f301866693c2fac6de48
        },
        { deep: true },
      );

      return { data };
    }),
  );
}

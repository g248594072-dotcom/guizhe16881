<template>
  <div
    class="game-time-display"
    :class="{ 'dark': isDarkMode }"
    title="游戏内时间（由变量控制，非现实时间）"
  >
    <div class="time-main">
      <i class="fa-regular fa-clock" aria-hidden="true"></i>
      <span class="time-text">{{ formattedTime }}</span>
      <span v-if="showWeekDay" class="week-day">{{ weekDay }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 游戏时间显示组件
 * 展示游戏内变量时间（年/月/日/时/分），完全由 MVU 变量控制
 * 非现实时间，与系统时钟无关，随剧情推进而更新
 */
import { computed } from 'vue';
import { formatGameTime, getDayOfWeekChinese, useGameTime } from '../utils/gameTime';

const props = withDefaults(defineProps<{
  isDarkMode?: boolean;
  showWeekDay?: boolean;
  format?: 'HH:mm' | 'YYYY-MM-DD HH:mm' | 'YYYY年MM月DD日 HH:mm' | '相对描述';
}>(), {
  isDarkMode: false,
  showWeekDay: true,
  format: 'YYYY年MM月DD日 HH:mm',
});

// 游戏时间响应式数据
const gameTime = useGameTime();

// 格式化时间显示
const formattedTime = computed(() => {
  return formatGameTime(gameTime.value, props.format);
});

// 星期几
const weekDay = computed(() => {
  return getDayOfWeekChinese(gameTime.value);
});
</script>

<style scoped lang="scss">
.game-time-display {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;

  &.dark {
    background: rgba(0, 0, 0, 0.5);
    color: #e0e0e0;
  }
}

.time-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;

  i {
    opacity: 0.7;
  }
}

.time-text {
  font-family: 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
}

.week-day {
  font-size: 0.8rem;
  opacity: 0.7;
  padding-left: 0.3rem;
  border-left: 1px solid currentColor;
}
</style>

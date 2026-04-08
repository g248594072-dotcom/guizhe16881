<template>
  <div class="stat-bar">
    <div class="bar-header">
      <span class="label">{{ label }}</span>
      <span class="value">{{ value }}</span>
    </div>
    <div class="bar-track">
      <div
        class="bar-fill"
        :class="{
          'bar-fill--cyan': accent === 'cyan',
          'bar-fill--magenta': accent === 'magenta',
          'bar-fill--purple': accent === 'purple',
        }"
        :style="{ width: `${percentage}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  percentage: number;
  /** 深色赛博条颜色（对齐规则新新前端） */
  accent?: 'cyan' | 'magenta' | 'purple';
}>();
</script>

<style lang="scss" scoped>
.stat-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;

  .label {
    color: #a1a1aa;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .value {
    color: #f4f4f5;
    font-family: monospace;
  }
}

:global(.light) .bar-header .value {
  color: #18181b;
}

.bar-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

:global(.light) .bar-track {
  background: rgba(0, 0, 0, 0.1);
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #52525b, #e4e4e7);
  border-radius: 2px;
  transition: width 1s ease-out;
}

.bar-fill--cyan {
  background: var(--color-neon-cyan);
  box-shadow: 0 0 6px rgba(0, 243, 255, 0.55);
}

.bar-fill--magenta {
  background: var(--color-neon-magenta);
  box-shadow: 0 0 6px rgba(255, 0, 255, 0.45);
}

.bar-fill--purple {
  background: var(--color-neon-purple);
  box-shadow: 0 0 6px rgba(176, 38, 255, 0.45);
}
</style>

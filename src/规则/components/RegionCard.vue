<template>
  <article class="region-card">
    <div class="card-header">
      <div class="title-group">
        <i class="fa-solid fa-map"></i>
        <h3>{{ name }}</h3>
      </div>
      <span class="rule-count">{{ ruleCount }} RULES</span>
    </div>
    <div class="rules-list">
      <div v-for="(rule, idx) in rules" :key="idx" class="rule-item">
        <div class="dot"></div>
        <p>{{ rule }}</p>
      </div>
    </div>
    <div class="card-footer">
      <button class="footer-btn edit" @click="$emit('openModal', 'edit_region', regionPayload)">
        <i class="fa-solid fa-pen"></i>
        <span>编辑</span>
      </button>
      <button class="footer-btn archive" @click="$emit('openModal', 'archive_region', regionPayload)">
        <i class="fa-solid fa-box-archive"></i>
        <span>归档</span>
      </button>
      <button class="footer-btn delete" @click="$emit('openModal', 'delete_region', regionPayload)">
        <i class="fa-solid fa-trash"></i>
        <span>删除</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string;
  ruleCount: number;
  rules: string[];
  region?: { id?: string; name: string; description?: string; rules?: string[] };
}>();

const regionPayload = computed(() => props.region ?? {
  id: props.name,
  name: props.name,
  description: Array.isArray(props.rules) ? props.rules.join('\n') : '',
});

defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
}>();
</script>

<style lang="scss" scoped>
.region-card {
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

:global(.light) .region-card {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;
}

.card-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);

  .title-group {
    display: flex;
    align-items: center;
    gap: 12px;

    i {
      font-size: 20px;
      color: #a1a1aa;
    }

    h3 {
      font-size: 16px;
      font-weight: 500;
      color: #fff;
    }
  }

  .rule-count {
    font-size: 12px;
    color: #71717a;
    font-family: monospace;
  }
}

:global(.light) .card-header {
  border-color: rgba(0, 0, 0, 0.05);
  background: rgba(0, 0, 0, 0.02);

  .title-group h3 {
    color: #18181b;
  }
}

.rules-list {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .rule-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #52525b;
      margin-top: 6px;
      flex-shrink: 0;
    }

    p {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.6;
    }
  }
}

.card-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.01);
  display: flex;
  gap: 8px;

  .footer-btn {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    color: #a1a1aa;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }

    &.archive:hover {
      color: #eab308;
      background: rgba(234, 179, 8, 0.15);
    }

    &.delete:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
  }
}

:global(.light) .card-footer {
  border-color: rgba(0, 0, 0, 0.05);

  button {
    color: #71717a;

    &:hover {
      color: #18181b;
      background: rgba(0, 0, 0, 0.05);
    }
  }
}
</style>

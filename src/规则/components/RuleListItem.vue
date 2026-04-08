<template>
  <article class="rule-item" :class="{ 'cyber-card': props.isDarkMode }">
    <div class="item-content">
      <div class="title-row">
        <h4>{{ title }}</h4>
        <span class="status-badge" :class="status">
          {{ status === 'active' ? '生效中' : '已归档' }}
        </span>
      </div>
      <p class="desc">{{ desc }}</p>
    </div>
    <div class="item-actions">
      <button class="action-btn edit" @click="$emit('openModal', 'edit_world_rule', rule)">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="action-btn delete" @click="$emit('openModal', 'delete_world_rule', rule)">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  desc: string;
  status: string;
  rule?: { id?: string; title: string; desc: string; status: string; [key: string]: any };
  isDarkMode?: boolean;
}>();

const rule = computed(() => props.rule ?? { title: props.title, desc: props.desc, status: props.status });

defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
}>();
</script>

<style lang="scss" scoped>
.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.rule-item:not(.cyber-card) {
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);

  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.rule-item.cyber-card {
  padding: 16px 20px;
  border-radius: 12px;
}

:global(.light) .rule-item:not(.cyber-card) {
  border-color: rgba(0, 0, 0, 0.1);
  background: #fff;

  &:hover {
    border-color: rgba(0, 0, 0, 0.2);
  }
}

.item-content {
  flex: 1;

  .title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;

    h4 {
      font-size: 16px;
      font-weight: 500;
      color: #f4f4f5;
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 1px solid;

      &.active {
        border-color: rgba(212, 212, 216, 0.3);
        color: #e4e4e7;
        background: rgba(212, 212, 216, 0.1);
      }

      &:not(.active) {
        border-color: #52525b;
        color: #71717a;
        background: rgba(39, 39, 42, 0.5);
      }
    }
  }

  .desc {
    font-size: 14px;
    color: #a1a1aa;
  }
}

:global(.light) .item-content {
  .title-row h4 {
    color: #18181b;
  }

  .desc {
    color: #71717a;
  }
}

.item-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;

  .rule-item:hover & {
    opacity: 1;
  }
}

.action-btn {
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: #a1a1aa;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &.delete:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
}

:global(.light) .action-btn {
  color: #71717a;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #18181b;
  }
}
</style>

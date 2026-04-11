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
      <button
        class="action-btn archive"
        title="归档"
        @click="$emit('openModal', 'archive_world_rule', rule)"
      >
        <i class="fa-solid fa-box-archive"></i>
      </button>
      <button
        class="action-btn delete"
        title="删除"
        @click="$emit('openModal', 'delete_world_rule', rule)"
      >
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
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  min-width: 0;
  /* 桌面端操作钮绝对定位，避免占位把正文挤成窄条 */
  padding-right: 8px;

  .title-row {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-bottom: 4px;

    h4 {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 16px;
      font-weight: 500;
      color: #f4f4f5;
      line-height: 1.35;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .status-badge {
      flex-shrink: 0;
      white-space: nowrap;
      align-self: center;
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
    line-height: 1.55;
    word-break: break-word;
    overflow-wrap: anywhere;
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
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  /* 不占横向 flex 宽度，避免手机/窄屏右侧大块空白 */
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(15, 15, 18, 0.88);
  backdrop-filter: blur(6px);

  .rule-item:hover & {
    opacity: 1;
    pointer-events: auto;
  }
}

:global(.light) .item-actions {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
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

  &.archive:hover {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
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

/* 窄屏与无精确 hover 的设备：操作栏回到文档流，避免「点了也没按钮」 */
@media (max-width: 768px), (max-width: 1024px) and (hover: none) {
  .rule-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .item-content {
    flex: none;
    width: 100%;
    padding-right: 0;
    order: 1;
  }

  .item-actions {
    position: static;
    opacity: 1;
    pointer-events: auto;
    align-self: flex-end;
    order: 2;
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;
    padding: 0;
  }

  :global(.light) .item-actions {
    box-shadow: none;
  }
}
</style>

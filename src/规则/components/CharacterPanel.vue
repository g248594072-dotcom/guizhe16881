<template>
  <div class="character-panel">
    <Transition name="slide" mode="out-in">
      <CharacterDetail
        v-if="selectedCharacter"
        :character-id="selectedCharacter"
        :is-dark-mode="isDarkMode"
        @back="selectedCharacter = null"
        @open-modal="(...args) => $emit('openModal', ...args)"
        @copy-to-input="$emit('copyToInput', $event)"
      />
      <CharacterList
        v-else
        @select="selectedCharacter = $event"
        @open-modal="$emit('openModal', $event)"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CharacterList from './CharacterList.vue';
import CharacterDetail from './CharacterDetail.vue';

withDefaults(defineProps<{ isDarkMode?: boolean }>(), { isDarkMode: false });

const selectedCharacter = ref<string | null>(null);

defineEmits<{
  (e: 'openModal', type: string, payload?: Record<string, any>): void;
  (e: 'copyToInput', text: string): void;
}>();
</script>

<style lang="scss" scoped>
.character-panel {
  position: relative;
  min-height: 400px;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>

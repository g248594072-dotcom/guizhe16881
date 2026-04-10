<template>
  <div class="phone-container">
    <!-- 手机外框 -->
    <div class="phone-frame">
      <!-- 刘海/灵动岛区域 -->
      <div class="notch-area">
        <div class="notch">
          <div class="camera"></div>
          <div class="speaker"></div>
        </div>
        <div class="status-icons">
          <span class="time">{{ currentTime }}</span>
          <div class="icons">
            <i class="fas fa-signal"></i>
            <i class="fas fa-wifi"></i>
            <i class="fas fa-battery-full"></i>
          </div>
        </div>
      </div>

      <!-- 手机屏幕内容 -->
      <div class="phone-screen">
        <!-- 聊天应用头部 -->
        <div class="chat-header">
          <div class="back-btn">
            <i class="fas fa-chevron-left"></i>
          </div>
          <div class="contact-info">
            <div class="avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="contact-details">
              <div class="contact-name">角色状态</div>
              <div class="contact-status">
                <span class="online-dot"></span>
                在线
              </div>
            </div>
          </div>
          <div class="header-actions">
            <i class="fas fa-phone"></i>
            <i class="fas fa-video"></i>
          </div>
        </div>

        <!-- 角色状态卡片区域 -->
        <div class="status-cards">
          <!-- 主要状态：生命值 -->
          <div class="status-card hp-card">
            <div class="card-header">
              <i class="fas fa-heart"></i>
              <span>生命值</span>
            </div>
            <div class="card-content">
              <div class="progress-ring">
                <svg viewBox="0 0 100 100">
                  <circle class="progress-ring-bg" cx="50" cy="50" r="45"/>
                  <circle
                    class="progress-ring-fill hp-fill"
                    cx="50"
                    cy="50"
                    r="45"
                    :stroke-dasharray="circumference"
                    :stroke-dashoffset="hpOffset"
                  />
                </svg>
                <div class="progress-text">
                  <span class="value">{{ characterStatus.hp }}</span>
                  <span class="max">/{{ characterStatus.hpMax }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 体力值 -->
          <div class="status-card sp-card">
            <div class="card-header">
              <i class="fas fa-bolt"></i>
              <span>体力值</span>
            </div>
            <div class="card-content">
              <div class="progress-bar">
                <div class="progress-fill sp-fill" :style="{ width: spPercent + '%' }"></div>
              </div>
              <div class="progress-info">
                <span>{{ characterStatus.sp }}/{{ characterStatus.spMax }}</span>
                <span>{{ spPercent }}%</span>
              </div>
            </div>
          </div>

          <!-- 心情值 -->
          <div class="status-card mood-card">
            <div class="card-header">
              <i class="fas fa-smile"></i>
              <span>心情</span>
            </div>
            <div class="card-content">
              <div class="mood-display">
                <div class="mood-emoji">{{ moodEmoji }}</div>
                <div class="mood-text">{{ characterStatus.mood }}</div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill mood-fill" :style="{ width: moodPercent + '%' }"></div>
              </div>
            </div>
          </div>

          <!-- 等级与经验 -->
          <div class="status-card level-card">
            <div class="card-header">
              <i class="fas fa-star"></i>
              <span>等级 {{ characterStatus.level }}</span>
            </div>
            <div class="card-content">
              <div class="exp-info">
                <span>经验值</span>
                <span>{{ characterStatus.exp }}/{{ characterStatus.expMax }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill exp-fill" :style="{ width: expPercent + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 属性列表 -->
        <div class="attributes-section">
          <div class="section-title">
            <i class="fas fa-chart-bar"></i>
            角色属性
          </div>
          <div class="attributes-grid">
            <div class="attr-item" v-for="(value, key) in characterStatus.attributes" :key="key">
              <div class="attr-icon">
                <i :class="attrIcons[key]"></i>
              </div>
              <div class="attr-info">
                <div class="attr-name">{{ attrNames[key] }}</div>
                <div class="attr-value">{{ value }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部消息输入区 -->
        <div class="chat-input-area">
          <div class="input-container">
            <i class="fas fa-plus-circle"></i>
            <div class="input-box">
              <span>点击查看详情...</span>
            </div>
            <i class="fas fa-microphone"></i>
          </div>
        </div>
      </div>

      <!-- 底部指示条 -->
      <div class="home-indicator"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { klona } from 'klona';
import { watchEffect } from 'vue';

// 角色状态数据
const characterStatus = ref({
  hp: 85,
  hpMax: 100,
  sp: 72,
  spMax: 100,
  mood: '愉悦',
  moodValue: 80,
  level: 12,
  exp: 2450,
  expMax: 3000,
  attributes: {
    strength: 18,
    agility: 15,
    intelligence: 22,
    constitution: 16,
    charisma: 14,
    luck: 12
  }
});

// 从消息楼层变量读取数据
const loadStatusFromVariables = () => {
  try {
    const vars = getVariables({ type: 'message', message_id: getCurrentMessageId() });
    if (vars && vars.characterStatus) {
      characterStatus.value = { ...characterStatus.value, ...vars.characterStatus };
    }
  } catch (e) {
    console.info('使用默认角色状态值');
  }
};

// 监听变量变化并保存（合并写入，避免 replaceVariables 整表替换冲掉 MVU 等同层字段）
watchEffect(() => {
  try {
    const mid = getCurrentMessageId();
    updateVariablesWith(vars => {
      if (!vars) vars = {};
      vars.characterStatus = klona(characterStatus.value);
      return vars;
    }, { type: 'message', message_id: mid });
  } catch (e) {
    console.warn('无法保存角色状态到变量:', e);
  }
});

// 当前时间
const currentTime = ref('');
let timeInterval: ReturnType<typeof setInterval>;

const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// 进度环计算
const circumference = 2 * Math.PI * 45;
const hpOffset = computed(() => {
  const percent = characterStatus.value.hp / characterStatus.value.hpMax;
  return circumference - (percent * circumference);
});

// 百分比计算
const spPercent = computed(() =>
  Math.round((characterStatus.value.sp / characterStatus.value.spMax) * 100)
);
const moodPercent = computed(() => characterStatus.value.moodValue);
const expPercent = computed(() =>
  Math.round((characterStatus.value.exp / characterStatus.value.expMax) * 100)
);

// 心情表情
const moodEmoji = computed(() => {
  const moodMap: Record<string, string> = {
    '愉悦': '😊',
    '开心': '😄',
    '平静': '😌',
    '疲惫': '😔',
    '焦虑': '😰',
    '愤怒': '😠',
    '悲伤': '😢',
    '兴奋': '🤩'
  };
  return moodMap[characterStatus.value.mood] || '😐';
});

// 属性名称映射
const attrNames: Record<string, string> = {
  strength: '力量',
  agility: '敏捷',
  intelligence: '智力',
  constitution: '体质',
  charisma: '魅力',
  luck: '幸运'
};

// 属性图标映射
const attrIcons: Record<string, string> = {
  strength: 'fas fa-fist-raised',
  agility: 'fas fa-running',
  intelligence: 'fas fa-brain',
  constitution: 'fas fa-shield-alt',
  charisma: 'fas fa-comments',
  luck: 'fas fa-clover'
};

onMounted(() => {
  loadStatusFromVariables();
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  clearInterval(timeInterval);
});
</script>

<style lang="scss" scoped>
// 颜色变量
$phone-bg: #1a1a1a;
$screen-bg: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
$primary: #007aff;
$hp-color: #ff3b30;
$sp-color: #ffcc00;
$mood-color: #34c759;
$exp-color: #af52de;
$text-primary: #1c1c1e;
$text-secondary: #8e8e93;
$card-bg: #ffffff;

.phone-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  min-height: 100%;
}

// 手机外框
.phone-frame {
  width: 100%;
  max-width: 375px;
  aspect-ratio: 9 / 19;
  background: $phone-bg;
  border-radius: 50px;
  padding: 12px;
  box-shadow:
    0 0 0 2px #2a2a2a,
    0 20px 60px rgba(0, 0, 0, 0.4),
    inset 0 0 20px rgba(255, 255, 255, 0.05);
  position: relative;
  display: flex;
  flex-direction: column;
}

// 刘海区域
.notch-area {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 160px;
  height: 35px;
  z-index: 100;

  .notch {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 30px;
    background: #000;
    border-radius: 0 0 20px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .camera {
      width: 10px;
      height: 10px;
      background: #1a1a1a;
      border-radius: 50%;
      box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
    }

    .speaker {
      width: 50px;
      height: 4px;
      background: #2a2a2a;
      border-radius: 2px;
    }
  }

  .status-icons {
    position: absolute;
    top: 12px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding: 0 15px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;

    .time {
      margin-left: 10px;
    }

    .icons {
      display: flex;
      gap: 5px;
      margin-right: 10px;

      i {
        font-size: 12px;
      }
    }
  }
}

// 手机屏幕
.phone-screen {
  flex: 1;
  background: $screen-bg;
  border-radius: 40px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

// 聊天头部
.chat-header {
  background: $card-bg;
  padding: 50px 15px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #e5e5ea;

  .back-btn {
    color: $primary;
    font-size: 18px;
    cursor: pointer;
  }

  .contact-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;

    .avatar {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, $primary, #5856d6);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
    }

    .contact-details {
      .contact-name {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
      }

      .contact-status {
        font-size: 12px;
        color: $text-secondary;
        display: flex;
        align-items: center;
        gap: 4px;

        .online-dot {
          width: 8px;
          height: 8px;
          background: $mood-color;
          border-radius: 50%;
        }
      }
    }
  }

  .header-actions {
    display: flex;
    gap: 15px;
    color: $primary;
    font-size: 18px;

    i {
      cursor: pointer;
    }
  }
}

// 状态卡片区域
.status-cards {
  padding: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  overflow-y: auto;
}

.status-card {
  background: $card-bg;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  &.hp-card {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 15px;

    .card-content {
      flex: 1;
      display: flex;
      justify-content: center;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 8px;

    i {
      font-size: 14px;
    }
  }

  .card-content {
    .progress-ring {
      width: 80px;
      height: 80px;
      position: relative;

      svg {
        transform: rotate(-90deg);
        width: 100%;
        height: 100%;

        circle {
          fill: none;
          stroke-width: 8;

          &.progress-ring-bg {
            stroke: #f0f0f0;
          }

          &.progress-ring-fill {
            stroke-linecap: round;
            transition: stroke-dashoffset 0.3s ease;
          }

          &.hp-fill {
            stroke: $hp-color;
          }
        }
      }

      .progress-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;

        .value {
          font-size: 24px;
          font-weight: 700;
          color: $text-primary;
        }

        .max {
          font-size: 12px;
          color: $text-secondary;
        }
      }
    }

    .progress-bar {
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;

        &.sp-fill {
          background: linear-gradient(90deg, $sp-color, #ff9500);
        }

        &.mood-fill {
          background: linear-gradient(90deg, $mood-color, #30d158);
        }

        &.exp-fill {
          background: linear-gradient(90deg, $exp-color, #bf5af2);
        }
      }
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 12px;
      color: $text-secondary;
    }

    .mood-display {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .mood-emoji {
        font-size: 24px;
      }

      .mood-text {
        font-size: 14px;
        color: $text-primary;
        font-weight: 500;
      }
    }

    .exp-info {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: $text-secondary;
      margin-bottom: 4px;
    }
  }
}

// 属性区域
.attributes-section {
  background: $card-bg;
  margin: 0 15px 15px;
  border-radius: 16px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      color: $primary;
    }
  }

  .attributes-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    .attr-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 12px;

      .attr-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, $primary, #5856d6);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 14px;
      }

      .attr-info {
        text-align: center;

        .attr-name {
          font-size: 11px;
          color: $text-secondary;
        }

        .attr-value {
          font-size: 16px;
          font-weight: 700;
          color: $text-primary;
        }
      }
    }
  }
}

// 聊天输入区域
.chat-input-area {
  background: $card-bg;
  padding: 10px 15px 30px;
  border-top: 1px solid #e5e5ea;

  .input-container {
    display: flex;
    align-items: center;
    gap: 10px;

    i {
      font-size: 24px;
      color: $text-secondary;

      &.fa-plus-circle {
        color: $text-secondary;
      }
    }

    .input-box {
      flex: 1;
      background: #f2f2f7;
      border-radius: 20px;
      padding: 10px 15px;
      font-size: 14px;
      color: $text-secondary;
    }
  }
}

// 底部指示条
.home-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 4px;
  background: #fff;
  border-radius: 2px;
  opacity: 0.5;
}
</style>

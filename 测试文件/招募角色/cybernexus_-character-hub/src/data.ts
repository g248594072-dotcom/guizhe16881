import { Character } from './types';

export const characters: Character[] = [
  {
    id: 'CHR-001',
    name: '白梦梦',
    age: 18,
    isSingle: true,
    intro: '总是充满元气，但意外地是个吃货，特别是对炸鸡有着无与伦比的执着。虽然看起来有点冒失，但在关键时刻非常可靠。',
    avatar: 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?q=80&w=300&h=300&auto=format&fit=crop',
    tags: ['活泼', '吃货', '元气满满'],
    details: {
      indicators: {
        height: 165,
        weight: 50,
        bwh: 'B86 W58 H88',
        constitution: '普通',
        affection: 32
      },
      psychology: {
        currentThought: '快点接过往喵！炸鸡快卖完了，要是买不到的话，绝对要发脾气的喵！肚子已经饿扁了喵~',
        traits: ['活泼: 有点小贪吃，句尾带着喵的萌点。', '随性: 不喜欢复杂的数学题，喜欢轻松的校园生活。']
      },
      vitals: {
        lust: 24,
        fetish: 10,
        description: '白梦梦目前生理状态稳定，因接近午休而略显饥饿。解开的衬衫扣子透出一丝凉爽，丝袜与大腿的摩擦让她感到微妙的舒适。'
      },
      location: {
        area: '圣华女子学院 / 学生餐厅 / 午餐时光',
        currentAction: '当前行为在食堂排队时，理直气壮地将饭卡递给对方，要求其代买甜辣炸鸡。',
        record: '午餐时光: 起 2026-04-24 12:15; 程度: 主要参与者'
      },
      fetishDetails: {
        sensitivePoints: ['大腿内侧'],
        fetishes: ['制服控'],
        hiddenFetishes: ['户外露出 (由于“下克上”可能带来的大胆指令倾向)']
      },
      clothing: {
        top: { name: '圣华学院衬衫', status: '微皱 (因排队挤压)', description: '纯白棉质衬衫，领口依旧解开一扣，透出随性的气息。' },
        bottom: { name: '格子褶皱裙', status: '平整', description: '深蓝色调的英伦风格格子裙。' },
        inner: { name: '纯棉内衣套装', status: '穿着中', description: '淡蓝色的少女款内衣。' },
        legs: { name: '白色丝质过膝袜', status: '紧致', description: '细腻的白丝，包裹着富有弹性的双腿。' },
        feet: { name: '黑色皮质乐福鞋', status: '干净', description: '校园风十足的圆头皮鞋。' }
      },
      accessories: [
        { id: 'acc1', name: '兔子圆珠笔', part: '手部', status: '持握', description: '带有可爱兔子装饰的蓝色圆珠笔。' },
        { id: 'acc2', name: '学生饭卡', part: '手部', status: '递出', description: '印有白梦梦证件照的塑料卡片，边缘被捏得有些温热。' }
      ]
    }
  },
  {
    id: 'CHR-002',
    name: '唐柚',
    age: 16,
    isSingle: true,
    intro: '冒失学妹，对恋爱充满浪漫幻想。刚刚考入圣华女子学院的高一新生，因为迷路经常在教学楼打转。',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&h=300&auto=format&fit=crop',
    tags: ['甜食控', '学院风', '浪漫主义'],
    details: {
      indicators: {
        height: 158,
        weight: 45,
        bwh: 'B80 W54 H82',
        constitution: '柔弱',
        affection: 15
      },
      psychology: {
        currentThought: '呜哇！对、对不起撞到您了！听说这里在招人，我虽然什么都不懂，但是体力很好哦！',
        traits: ['冒失: 走路经常平地摔，但总能笑着站起来。', '勤奋: 虽然笨手笨脚但非常努力。']
      },
      vitals: {
        lust: 10,
        fetish: 5,
        description: '唐柚正处于极度紧张状态，小脸微红。口袋里永远装着水果糖，笑起来有两颗可爱的小虎牙。'
      },
      location: {
        area: '圣华女子学院 / 教学楼走廊',
        currentAction: '正在寻找学生会办公室，但不小心走到了旧校舍。',
        record: '探险时光: 起 2026-04-24 09:30; 程度: 误入者'
      },
      fetishDetails: {
        sensitivePoints: ['耳朵'],
        fetishes: ['头饰控'],
        hiddenFetishes: ['依赖倾向']
      },
      clothing: {
        top: { name: '新制校服衬衫', status: '整洁', description: '略显宽大的学院制服，粉色小熊刺绣十分显眼。' },
        bottom: { name: '学院百褶裙', status: '平整', description: '深灰色的校服短裙。' },
        inner: { name: '印花内衣', status: '穿着中', description: '印有小熊图案的舒适内衣。' },
        legs: { name: '过膝袜', status: '整齐', description: '领结总是打得歪歪扭扭，但袜子却拉得很齐。' },
        feet: { name: '学生皮鞋', status: '略有磨损', description: '因为经常走错路，鞋底磨损较快。' }
      },
      accessories: [
        { id: 'acc3', name: '草莓味棒棒糖', part: '口中', status: '含着', description: '缓解紧张心情的必备甜食。' }
      ]
    }
  },
  {
    id: 'CHR-003',
    name: '白芷琪',
    age: 17,
    isSingle: true,
    intro: '傲娇大小姐，跨国财团的千金。平时在人前总是一副高高在上的优雅姿态，实际上极度怕黑且喜欢收集毛绒玩具。',
    avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&h=300&auto=format&fit=crop',
    tags: ['大小姐', '古典乐迷', '反差萌'],
    details: {
      indicators: {
        height: 168,
        weight: 52,
        bwh: 'B88 W56 H90',
        constitution: '优雅',
        affection: 10
      },
      psychology: {
        currentThought: '只是最贵的下午茶套餐而已，不要以为这样就能收买我！(偷偷盯着别人的炸鸡块咽口水)',
        traits: ['傲娇: 说出口的话和心里想的完全相反。', '品味极高: 对艺术和生活品质有着近乎病态的追求。']
      },
      vitals: {
        lust: 15,
        fetish: 15,
        description: '白芷琪维持着优雅的坐姿，但心里却在纠结要不要尝试一下平民的零食。'
      },
      location: {
        area: '圣华女子学院 / 休息室',
        currentAction: '正在阅读乐谱，但注意力明显不在纸上。',
        record: '静谧时光: 起 2026-04-24 14:00; 程度: 沉思者'
      },
      fetishDetails: {
        sensitivePoints: ['脖颈'],
        fetishes: ['黑丝控'],
        hiddenFetishes: ['占有欲强']
      },
      clothing: {
        top: { name: '量身定制校服', status: '完美', description: '名家设计的修身版校服，金丝滚边彰显地位。' },
        bottom: { name: '真丝短裙', status: '丝滑', description: '高档面料制成的学校制式短裙。' },
        inner: { name: '蕾丝内衣套装', status: '穿着中', description: '黑色蕾丝边的奢华内衣。' },
        legs: { name: '连裤袜', status: '一尘不染', description: '薄透的黑丝连裤袜，透出健康肤色。' },
        feet: { name: '定制小皮鞋', status: '闪亮', description: '每天都会由专人擦拭至反光。' }
      },
      accessories: [
        { id: 'acc4', name: '名贵胸针', part: '胸口', status: '佩戴', description: '镶嵌着蓝宝石的校徽装饰。' }
      ]
    }
  }
];

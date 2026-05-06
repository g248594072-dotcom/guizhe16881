/**
 * Built-in seed content for Rule Creative Workshop
 * These are official examples for each content type
 */
import type { ContentType, ContentMetadata } from './models/content';

export interface SeedContent {
  type: ContentType;
  name: string;
  description: string;
  author: string;
  downloads: number;
  likes: number;
  data: unknown;
}

export const BUILTIN_SEEDS: SeedContent[] = [
  {
    type: 'world-rule',
    name: '全女',
    description: '整个世界都是女性，外貌最大不超过35岁',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '全女',
      效果描述: '整个世界都是女性，外貌最大不超过35岁',
      状态: '生效中',
      细分规则: {},
      适用对象: '全局',
      标记: '世界级'
    }
  },
  {
    type: 'regional-rule',
    name: '发情',
    description: '这个区域内的所有人都会保持微微发情的状态',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      规则名: '发情',
      描述: '这个区域内的所有人都会保持微微发情的状态'
    }
  },
  {
    type: 'personal-rule',
    name: '体液增加',
    description: '这个人的体液会更加多',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '体液增加',
      效果描述: '这个人的体液会更加多',
      状态: '生效中',
      细分规则: {},
      适用对象: '',
      标记: '个人级'
    }
  },
  {
    type: 'region',
    name: '商业街',
    description: '繁华的商业区域，包含购物中心、摊贩和步行街',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '商业街',
      描述: '繁华的商业区域，包含购物中心、摊贩和步行街',
      包含建筑: {}
    }
  },
  {
    type: 'building',
    name: '神秘地牢',
    description: '可供探险的神秘地下建筑，内部设有各种陷阱房间',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      名称: '神秘地牢',
      描述: '可供探险的神秘地下建筑，内部设有各种陷阱房间',
      所属区域: '',
      内部房间布局: {
        '触手陷阱房': { 描述: '房间内潜伏着饥渴的触手，会对进入者发起袭击' },
        '宝箱陷阱房': { 描述: '看似普通的宝箱，实则是拟态怪物伪装的陷阱' }
      }
    }
  },
  {
    type: 'character',
    name: '白梦梦',
    description: '一个可爱傲娇的少女',
    author: '工坊官方示例',
    downloads: 0,
    likes: 0,
    data: {
      姓名: '白梦梦',
      角色简介: '一个可爱傲娇的少女',
      当前位置: {
        区域: '',
        建筑: '',
        房间: ''
      }
    }
  }
];

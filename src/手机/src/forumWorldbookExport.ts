/**
 * 论坛世界书导出模块
 * 【面具下的树洞】将论坛帖子导出到世界书供AI参考
 */

import { getAllForumPosts, getCommentsByPostId, type ForumPost } from './forumIndexedDb';
import type { ForumWorldbookExport, ForumIdentityType } from './types/forum';

/**
 * 构建帖子导出格式
 */
function formatPostForExport(post: ForumPost, includeComments: boolean = false): string {
  const identityLabel: Record<ForumIdentityType, string> = {
    anonymous: '匿名网友',
    username: '特征网名用户',
    real_name: '实名用户',
    role_title: '身份认证用户',
  };

  let content = `[帖子] ${post.title}
作者: ${post.authorName} (${identityLabel[post.identityType]})
日期: ${post.gameDate}
类型: ${post.postType}
标签: ${post.tags.join(', ')}
互动: ${post.likes}赞 | ${post.views}浏览 | ${post.comments}评论

${post.content}`;

  if (includeComments && post.comments > 0) {
    // 评论内容会通过异步加载添加
    content += '\n\n[评论]\n';
  }

  return content;
}

/**
 * 导出论坛帖子列表（用于世界书同步）
 * 获取最近N个帖子作为论坛氛围的参考
 */
export async function exportForumPostsForWorldbook(
  limit: number = 10,
): Promise<ForumWorldbookExport> {
  try {
    const posts = await getAllForumPosts();
    const recentPosts = posts.slice(0, limit);

    const exportData: ForumWorldbookExport = {
      posts: recentPosts.map(p => ({
        id: p.id,
        authorName: p.authorName,
        identityType: p.identityType,
        title: p.title,
        content: p.content,
        gameDate: p.gameDate,
        postType: p.postType,
        tags: p.tags,
        likes: p.likes,
        comments: p.comments,
      })),
      exportedAt: Date.now(),
    };

    return exportData;
  } catch (e) {
    console.error('[forumWorldbookExport] 导出论坛帖子失败:', e);
    return { posts: [], exportedAt: Date.now() };
  }
}

/**
 * 导出单个帖子的完整内容（包含评论）
 */
export async function exportSinglePostForWorldbook(postId: string): Promise<string> {
  try {
    const { getForumPostById } = await import('./forumIndexedDb');
    const post = await getForumPostById(postId);
    if (!post) {
      return '';
    }

    const identityLabel: Record<ForumIdentityType, string> = {
      anonymous: '匿名网友',
      username: '特征网名用户',
      real_name: '实名用户',
      role_title: '身份认证用户',
    };

    let content = `[面具下的树洞 - 帖子详情]
标题: ${post.title}
作者: ${post.authorName} (${identityLabel[post.identityType]})
发帖时间: ${post.gameDate}
帖子类型: ${post.postType}
标签: ${post.tags.join(', ')}
互动数据: ${post.likes}赞 | ${post.views}浏览 | ${post.comments}评论

帖子内容:
${post.content}`;

    // 加载评论
    if (post.comments > 0) {
      const comments = await getCommentsByPostId(postId);
      if (comments.length > 0) {
        content += '\n\n[评论区]';
        comments.forEach((c, idx) => {
          content += `\n\n${idx + 1}. ${c.authorName} (${identityLabel[c.identityType]}):`;
          if (c.replyTo) {
            content += ` [回复 ${c.replyTo.authorName}]`;
          }
          content += `\n${c.content}`;
          if (c.likes > 0) {
            content += ` (${c.likes}赞)`;
          }
        });
      }
    }

    return content;
  } catch (e) {
    console.error('[forumWorldbookExport] 导出单个帖子失败:', e);
    return '';
  }
}

/**
 * 导出角色的所有帖子（追踪角色在论坛的活动）
 */
export async function exportCharacterForumPosts(characterId: string): Promise<string> {
  try {
    const { getForumPostsByCharacter } = await import('./forumIndexedDb');
    const posts = await getForumPostsByCharacter(characterId);

    if (posts.length === 0) {
      return '';
    }

    const identityLabel: Record<ForumIdentityType, string> = {
      anonymous: '匿名',
      username: '网名',
      real_name: '实名',
      role_title: '身份',
    };

    let content = `[面具下的树洞 - 角色论坛活动记录]
该角色在论坛共发布 ${posts.length} 个帖子：\n`;

    posts.forEach((p, idx) => {
      content += `\n\n[${idx + 1}] ${p.title} (${identityLabel[p.identityType]}: ${p.authorName})
`;
      content += `日期: ${p.gameDate} | 标签: ${p.tags.join(', ')}\n`;
      content += `${p.content.slice(0, 200)}${p.content.length > 200 ? '...' : ''}\n`;
    });

    return content;
  } catch (e) {
    console.error('[forumWorldbookExport] 导出角色帖子失败:', e);
    return '';
  }
}

/**
 * 生成世界书格式的论坛概览
 * 用于AI理解当前论坛的整体氛围
 */
export async function generateForumWorldbookEntry(): Promise<string> {
  try {
    const posts = await getAllForumPosts();

    if (posts.length === 0) {
      return '[面具下的树洞] 当前论坛暂无帖子。';
    }

    // 统计信息
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);

    // 热门标签统计
    const tagCounts: Record<string, number> = {};
    posts.forEach(p => {
      p.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => `${tag}(${count})`);

    // 最近热门帖子
    const hotPosts = posts
      .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
      .slice(0, 5);

    let content = `[面具下的树洞 - 论坛概览]
这是一个匿名论坛，用户可以卸下现实包袱，以真实身份发帖。

[论坛统计]
总帖子数: ${totalPosts}
总点赞: ${totalLikes}
总评论: ${totalComments}
热门标签: ${topTags.join(', ')}

[热门帖子]
`;

    hotPosts.forEach((p, idx) => {
      content += `\n${idx + 1}. [${p.tags[0] || '树洞'}] ${p.title} (${p.likes}赞, ${p.comments}评)`;
      content += `\n   作者: ${p.authorName}\n`;
    });

    content += '\n\n[最新帖子]
';
    posts.slice(0, 3).forEach((p, idx) => {
      content += `\n${idx + 1}. [${p.tags[0] || '树洞'}] ${p.title}`;
      content += `\n   ${p.content.slice(0, 100)}${p.content.length > 100 ? '...' : ''}\n`;
    });

    return content;
  } catch (e) {
    console.error('[forumWorldbookExport] 生成论坛概览失败:', e);
    return '';
  }
}

/**
 * 请求壳脚本将论坛内容同步到世界书
 * 通过 postMessage 发送给壳脚本处理
 */
export function requestSyncForumToWorldbook(
  scopeId: string = 'local-offline',
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      resolve({ ok: false, error: '同步请求超时' });
    }, 10000);

    // 监听响应
    const handler = (e: MessageEvent) => {
      const d = e.data as { type?: string; requestId?: string; ok?: boolean; error?: string };
      if (d?.type === 'tavern-phone:sync-forum-worldbook-result' && d.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve({ ok: d.ok ?? false, error: d.error });
      }
    };
    window.addEventListener('message', handler);

    // 导出数据并发送
    exportForumPostsForWorldbook(20).then(data => {
      window.parent.postMessage(
        {
          type: 'tavern-phone:request-sync-forum-worldbook',
          requestId,
          scopeId,
          forumData: data,
          entryContent: null, // 由壳脚本调用 generateForumWorldbookEntry() 生成
        },
        '*',
      );
    });
  });
}

/**
 * 导出指定 scope 的论坛数据（用于壳脚本调用）
 * 壳脚本会在需要同步世界书时调用此函数
 */
export async function idbExportForumForScope(
  scopeId: string = 'local-offline',
): Promise<ForumWorldbookExport> {
  // 目前论坛数据不按 scope 隔离，所有帖子都导出
  // 如果未来需要按聊天文件隔离，可以在此处添加过滤逻辑
  return exportForumPostsForWorldbook(50);
}

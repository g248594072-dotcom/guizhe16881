// 这是修复后的 openDetail 函数，需要替换原文件中的对应部分

async function openDetail(id: string, type: WorkshopContentType): Promise<void> {
  // 优先从本地存储获取
  const localContent = getLocalContent(id, type);
  if (localContent) {
    console.log('[规则工坊] 从本地获取内容:', id);
    const c: ContentMetadata & { data: unknown } = {
      id: localContent.id,
      type: localContent.type,
      name: localContent.name,
      description: localContent.description,
      author: localContent.author,
      authorId: 'local',
      authorAvatar: null,
      tags: localContent.tags,
      status: localContent.status,
      createdAt: localContent.createdAt,
      updatedAt: localContent.updatedAt,
      downloads: localContent.downloads,
      likes: localContent.likes,
      data: localContent.data,
    };

    state.detail.meta = c;
    state.detail.data = c.data;
    state.detail.jsonText = JSON.stringify({ meta: c, data: c.data }, null, 2);

    // 构建更美观的详情展示
    const icon = TYPE_ICONS[c.type];
    const metaHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${icon}</span>
        <span style="color:#00f3ff;font-weight:600">${escapeHtml(WORKSHOP_TYPE_LABELS[c.type])}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#ff00ff">${escapeHtml(c.author)}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#f0f800">♥ ${c.likes || 0}</span>
        <span style="color:#6b7c8e">|</span>
        <span>⬇ ${c.downloads || 0}</span>
      </div>
      <div style="color:#6b7c8e;font-size:10px;font-family:ui-monospace,monospace">
        ID: ${escapeHtml(c.id)} · 更新: ${new Date(c.updatedAt).toLocaleDateString()}
      </div>
    `;

    // 如果是区域规则、个人规则或建筑，从消息楼层变量中读取 stat_data
    if (c.type === 'regional-rule' || c.type === 'personal-rule' || c.type === 'building') {
      const { regions, regionDataList, characters } = await fetchAvailableRegionsAndCharacters();
      state.detail.availableRegions = regions;
      state.detail.availableRegionDataList = regionDataList;
      state.detail.availableCharacters = characters;
    } else {
      state.detail.availableRegions = [];
      state.detail.availableRegionDataList = [];
      state.detail.availableCharacters = [];
    }

    // 构建格式化内容展示（替代JSON）
    const contentHtml = formatDetailContent(c.description, c.data, c.type, state.detail.availableRegions, state.detail.availableCharacters, state.detail.availableRegionDataList);

    $(`[data-${ROOT_NS}=detail-title]`).text(c.name);
    $(`[data-${ROOT_NS}=detail-meta]`).html(metaHtml);
    $(`[data-${ROOT_NS}=detail-pre]`).html(contentHtml);
    updateDetailLikeButton();
    $(`[data-${ROOT_NS}=detail-bg]`).addClass('show');
    return; // 本地获取成功，直接返回
  }

  // 本地没有，尝试从后端 API 获取
  try {
    const j = await apiJson<{ content: ContentMetadata & { data: unknown } }>(
      `/api/content/get/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    );
    const c = j.content;
    state.detail.meta = c;
    state.detail.data = c.data;
    state.detail.jsonText = JSON.stringify({ meta: c, data: c.data }, null, 2);

    // 构建更美观的详情展示
    const icon = TYPE_ICONS[c.type];
    const metaHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${icon}</span>
        <span style="color:#00f3ff;font-weight:600">${escapeHtml(WORKSHOP_TYPE_LABELS[c.type])}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#ff00ff">${escapeHtml(c.author)}</span>
        <span style="color:#6b7c8e">|</span>
        <span style="color:#f0f800">♥ ${c.likes || 0}</span>
        <span style="color:#6b7c8e">|</span>
        <span>⬇ ${c.downloads || 0}</span>
      </div>
      <div style="color:#6b7c8e;font-size:10px;font-family:ui-monospace,monospace">
        ID: ${escapeHtml(c.id)} · 更新: ${new Date(c.updatedAt).toLocaleDateString()}
      </div>
    `;

    // 如果是区域规则、个人规则或建筑，从消息楼层变量中读取 stat_data
    if (c.type === 'regional-rule' || c.type === 'personal-rule' || c.type === 'building') {
      const { regions, regionDataList, characters } = await fetchAvailableRegionsAndCharacters();
      state.detail.availableRegions = regions;
      state.detail.availableRegionDataList = regionDataList;
      state.detail.availableCharacters = characters;
    } else {
      state.detail.availableRegions = [];
      state.detail.availableRegionDataList = [];
      state.detail.availableCharacters = [];
    }

    // 构建格式化内容展示（替代JSON）
    const contentHtml = formatDetailContent(c.description, c.data, c.type, state.detail.availableRegions, state.detail.availableCharacters, state.detail.availableRegionDataList);

    $(`[data-${ROOT_NS}=detail-title]`).text(c.name);
    $(`[data-${ROOT_NS}=detail-meta]`).html(metaHtml);
    $(`[data-${ROOT_NS}=detail-pre]`).html(contentHtml);
    updateDetailLikeButton();
    $(`[data-${ROOT_NS}=detail-bg]`).addClass('show');
  } catch (e) {
    console.error('[规则工坊] 从后端获取内容失败:', e);
    // API 失败且本地也没有，才显示 demo 数据
    toastr.error('本地未找到此内容，且后端获取失败');
  }
}

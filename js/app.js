/**
 * 闪卡应用主逻辑
 */
const App = (() => {
  // ========== 状态 ==========
  let currentCardIndex = 0;
  let studyCards = [];
  let startTime = 0;
  let timerInterval = null;
  let pendingImages = [];    // 弹窗中暂存的图片 base64
  let pendingDeleteId = null;
  let studyStats = { forgot: 0, think: 0, remembered: 0 };

  // ========== 页面导航 ==========
  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
  }

  function updateHomeStats() {
    const stats = Store.getStats();
    const reviewCount = Store.getTodayReviewCards().length;
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-new').textContent = stats.newCount;
    document.getElementById('stat-review').textContent = reviewCount;
  }

  function goHome() {
    stopTimer();
    showPage('page-home');
    updateHomeStats();
  }

  function goToAdd() {
    showPage('page-add');
    renderCardList();
  }

  function goToStudy() {
    // 获取今日学习计划
    studyCards = Store.getStudyPlan();
    if (studyCards.length === 0) {
      showPage('page-study');
      document.getElementById('study-area').style.display = 'flex';
      document.getElementById('study-card').style.display = 'none';
      document.getElementById('empty-study').style.display = 'block';
      document.getElementById('study-complete').style.display = 'none';
      document.getElementById('study-progress').textContent = '0 / 0';
      return;
    }

    currentCardIndex = 0;
    studyStats = { forgot: 0, think: 0, remembered: 0 };
    startTime = Date.now();
    showPage('page-study');
    startTimer();
    showCurrentCard();
  }

  // ========== 计时器 ==========
  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('study-timer').textContent = `${mins}:${secs}`;
  }

  function getElapsedMinutes() {
    return Math.round((Date.now() - startTime) / 60000);
  }

  // ========== 闪卡列表 ==========
  function renderCardList() {
    const cards = Store.getAllCards();
    const stats = Store.getStats();
    const records = Store.loadRecords ? null : null; // 不需要

    document.getElementById('add-total').textContent = stats.total;
    document.getElementById('add-new').textContent = stats.newCount;
    document.getElementById('add-old').textContent = stats.oldCount;

    const listEl = document.getElementById('card-list');
    const emptyEl = document.getElementById('add-empty');

    if (cards.length === 0) {
      listEl.innerHTML = '';
      listEl.appendChild(emptyEl);
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = '';

    // 倒序展示（最新在前）
    const reversed = [...cards].reverse();
    reversed.forEach(card => {
      const item = document.createElement('div');
      item.className = 'card-item';

      const badgeClass = card.isNew ? 'badge-new' : 'badge-review';
      const badgeText = card.isNew ? '新词' : '旧词';
      const statusText = SpacedRepetition.getStatusText(Store.getRecord(card.id));
      const imageCount = card.images ? card.images.length : 0;

      item.innerHTML = `
        <div class="card-item-info">
          <div>
            <span class="card-item-word">${escapeHtml(card.word)}</span>
            <span class="card-item-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="card-item-hint">${escapeHtml(card.hint || '')}</div>
          ${imageCount > 0 ? `<div class="card-item-images">${imageCount} 张图片</div>` : ''}
        </div>
        <button class="card-item-delete" data-id="${card.id}" onclick="App.openDeleteDialog(${card.id})">✕</button>
      `;
      listEl.appendChild(item);
    });
  }

  // ========== 添加弹窗 ==========
  function openAddDialog() {
    document.getElementById('input-word').value = '';
    document.getElementById('input-hint').value = '';
    document.getElementById('dialog-title').textContent = '添加闪卡';
    pendingImages = [];
    document.getElementById('add-dialog').style.display = 'flex';
    setTimeout(() => document.getElementById('input-word').focus(), 100);
  }

  function closeAddDialog() {
    document.getElementById('add-dialog').style.display = 'none';
    pendingImages = [];
  }

  function confirmWord() {
    const word = document.getElementById('input-word').value.trim();
    const hint = document.getElementById('input-hint').value.trim();
    if (!word) {
      showToast('请输入单词');
      return;
    }
    // 关闭添加弹窗，打开图片选择弹窗
    document.getElementById('add-dialog').style.display = 'none';
    openImageDialog(word);
  }

  // ========== 图片搜索弹窗 ==========
  let currentSearchWord = '';
  let selectedImageUrls = [];  // 用户选中的网络图片 URL
  let imageSearchPage = 1;

  function openImageDialog(word) {
    currentSearchWord = word;
    selectedImageUrls = [];
    imageSearchPage = 1;
    document.getElementById('image-dialog').style.display = 'flex';
    document.getElementById('btn-image-confirm').textContent = '确定';
    loadSearchImages();
  }

  function closeImageDialog() {
    document.getElementById('image-dialog').style.display = 'none';
    selectedImageUrls = [];
  }

  async function loadSearchImages() {
    const grid = document.getElementById('image-search-grid');
    grid.innerHTML = '<div class="image-loading">正在搜索图片...</div>';

    try {
      // 使用 Unsplash Source API（免费，无需 key）
      // 生成多个随机图片 URL
      const images = [];
      const count = 9;
      for (let i = 0; i < count; i++) {
        // 使用 picsum + 单词作为 seed，保证同一单词每次结果一致但不同单词不同
        const seed = `${currentSearchWord}_${imageSearchPage}_${i}`;
        images.push({
          url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/300/300`,
          thumb: `https://picsum.photos/seed/${encodeURIComponent(seed)}/300/300`
        });
      }

      renderImageGrid(images);
    } catch (err) {
      grid.innerHTML = '<div class="image-error">图片加载失败，请重试</div>';
    }
  }

  function renderImageGrid(images) {
    const grid = document.getElementById('image-search-grid');
    grid.innerHTML = '';

    // 第一格：本地添加
    const localItem = document.createElement('div');
    localItem.className = 'image-search-item local-add';
    localItem.innerHTML = '<span>+</span>';
    localItem.onclick = () => document.getElementById('file-input').click();
    grid.appendChild(localItem);

    images.forEach((img, index) => {
      const item = document.createElement('div');
      item.className = 'image-search-item';
      item.dataset.url = img.url;
      item.innerHTML = `
        <img src="${img.thumb}" alt="" loading="lazy">
        <div class="img-checkbox">✓</div>
      `;
      item.onclick = () => toggleImageSelection(item, img.url);
      grid.appendChild(item);
    });
  }

  function toggleImageSelection(item, url) {
    const idx = selectedImageUrls.indexOf(url);
    if (idx >= 0) {
      selectedImageUrls.splice(idx, 1);
      item.classList.remove('selected');
    } else {
      if (selectedImageUrls.length >= 5) {
        showToast('最多选择5张图片');
        return;
      }
      selectedImageUrls.push(url);
      item.classList.add('selected');
    }
    updateConfirmButton();
  }

  function updateConfirmButton() {
    const btn = document.getElementById('btn-image-confirm');
    btn.textContent = selectedImageUrls.length > 0 ? `确定 (${selectedImageUrls.length})` : '确定';
  }

  function refreshImages() {
    imageSearchPage++;
    selectedImageUrls = [];
    updateConfirmButton();
    loadSearchImages();
  }

  function confirmImageSelection() {
    // 将选中的网络图片 URL 加入 pendingImages
    pendingImages = [...selectedImageUrls];
    closeImageDialog();

    // 直接完成添加
    const word = document.getElementById('input-word').value.trim();
    const hint = document.getElementById('input-hint').value.trim();

    Store.addCard(word, hint, [...pendingImages]);
    pendingImages = [];
    renderCardList();
    showToast('添加成功');
  }

  // ========== 本地图片选择（从图片弹窗触发） ==========
  function handleImageSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remaining = 5 - selectedImageUrls.length;
    if (remaining <= 0) {
      showToast('最多只能添加5张图片');
      event.target.value = '';
      return;
    }

    const toProcess = Array.from(files).slice(0, remaining);
    let processed = 0;

    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedImageUrls.push(e.target.result);
        processed++;
        if (processed === toProcess.length) {
          // 重新渲染网格，在末尾添加本地图片
          appendLocalImages();
          updateConfirmButton();
        }
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  }

  function appendLocalImages() {
    const grid = document.getElementById('image-search-grid');
    // 移除已有的本地图片项（避免重复）
    grid.querySelectorAll('.local-image-item').forEach(el => el.remove());

    // 找出新添加的本地图片（base64）
    const localImages = selectedImageUrls.filter(url => url.startsWith('data:'));
    localImages.forEach((url, idx) => {
      const item = document.createElement('div');
      item.className = 'image-search-item selected local-image-item';
      item.dataset.url = url;
      item.innerHTML = `
        <img src="${url}" alt="">
        <div class="img-checkbox">✓</div>
      `;
      item.onclick = () => toggleImageSelection(item, url);
      grid.appendChild(item);
    });
  }

  // ========== 删除弹窗 ==========
  function openDeleteDialog(id) {
    pendingDeleteId = id;
    document.getElementById('delete-dialog').style.display = 'flex';
  }

  function closeDeleteDialog() {
    document.getElementById('delete-dialog').style.display = 'none';
    pendingDeleteId = null;
  }

  function confirmDelete() {
    if (pendingDeleteId !== null) {
      Store.deleteCard(pendingDeleteId);
      closeDeleteDialog();
      renderCardList();
      showToast('已删除');
    }
  }

  // ========== 学习逻辑 ==========
  function showCurrentCard() {
    if (currentCardIndex >= studyCards.length) {
      showCompletePage();
      return;
    }

    const card = studyCards[currentCardIndex];

    document.getElementById('study-area').style.display = 'flex';
    document.getElementById('empty-study').style.display = 'none';
    document.getElementById('study-card').style.display = 'flex';
    document.getElementById('study-complete').style.display = 'none';

    // 更新进度
    document.getElementById('study-progress').textContent =
      `${currentCardIndex + 1} / ${studyCards.length}`;

    // 显示单词
    document.getElementById('study-word').textContent = card.word;
    document.getElementById('study-hint').textContent = card.hint || '';

    // 隐藏答案
    document.getElementById('answer-section').style.display = 'none';
    document.getElementById('btn-reveal').style.display = 'block';
    document.getElementById('feedback-buttons').style.display = 'none';

    // 动画
    const studyCard = document.getElementById('study-card');
    studyCard.classList.remove('card-slide-in');
    void studyCard.offsetWidth; // 触发 reflow
    studyCard.classList.add('card-slide-in');

    // 自动播放发音
    setTimeout(() => playPronunciation(), 300);
  }

  function revealAnswer() {
    const card = studyCards[currentCardIndex];
    document.getElementById('btn-reveal').style.display = 'none';
    document.getElementById('feedback-buttons').style.display = 'flex';

    // 显示图片（随机选一张）
    const answerSection = document.getElementById('answer-section');
    const imageEl = document.getElementById('study-image');
    const meaningEl = document.getElementById('study-meaning');

    if (card.images && card.images.length > 0) {
      const randomIndex = Math.floor(Math.random() * card.images.length);
      imageEl.src = card.images[randomIndex];
      imageEl.style.display = 'block';
      document.querySelector('.card-image-wrapper').style.display = 'flex';
    } else {
      imageEl.style.display = 'none';
      document.querySelector('.card-image-wrapper').style.display = 'none';
    }

    // 中文释义（使用提示语作为释义展示）
    meaningEl.textContent = card.hint || '（无释义）';
    answerSection.style.display = 'flex';
  }

  function handleFeedback(feedback) {
    const card = studyCards[currentCardIndex];

    // 更新统计
    studyStats[feedback]++;

    // 更新间隔重复记录
    const currentRecord = Store.getRecord(card.id);
    const newRecord = SpacedRepetition.processFeedback(currentRecord, feedback);
    Store.updateRecord(card.id, newRecord);

    // 如果是新词，标记为旧词
    if (card.type === 'new') {
      Store.markAsOld(card.id);
    }

    // 下一张
    currentCardIndex++;
    showCurrentCard();
  }

  function showCompletePage() {
    stopTimer();
    const elapsed = getElapsedMinutes();

    document.getElementById('study-area').style.display = 'none';
    document.getElementById('study-card').style.display = 'none';
    document.getElementById('study-complete').style.display = 'flex';
    document.getElementById('study-progress').textContent = '完成';

    document.getElementById('complete-total').textContent = studyCards.length;
    document.getElementById('complete-forgot').textContent = studyStats.forgot;
    document.getElementById('complete-think').textContent = studyStats.think;
    document.getElementById('complete-remembered').textContent = studyStats.remembered;
    document.getElementById('complete-time').textContent = `${elapsed} 分钟`;
  }

  // ========== 退出学习 ==========
  function confirmQuitStudy() {
    document.getElementById('quit-dialog').style.display = 'flex';
  }

  function closeQuitDialog() {
    document.getElementById('quit-dialog').style.display = 'none';
  }

  function quitStudy() {
    closeQuitDialog();
    stopTimer();
    goHome();
  }

  // ========== 发音 ==========
  function playPronunciation() {
    const card = studyCards[currentCardIndex];
    if (!card) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      // 主动筛选美音 voice，优先选带 US/United States 的
      const voices = window.speechSynthesis.getVoices();
      const usVoice = voices.find(v => v.lang === 'en-US' && /us|united states/i.test(v.name))
                   || voices.find(v => v.lang === 'en-US')
                   || voices.find(v => v.lang.startsWith('en'));
      if (usVoice) {
        utterance.voice = usVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  }

  // ========== 工具函数 ==========
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg) {
    // 移除已有的 toast
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 1500);
  }

  // ========== 初始化 ==========
  function init() {
    updateHomeStats();
    // 预加载语音列表（Chrome 首次返回空，需监听事件）
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices();
      });
    }
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    goHome,
    goToAdd,
    goToStudy,
    openAddDialog,
    closeAddDialog,
    confirmWord,
    handleImageSelect,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
    revealAnswer,
    handleFeedback,
    playPronunciation,
    confirmQuitStudy,
    closeQuitDialog,
    quitStudy,
    closeImageDialog,
    confirmImageSelection,
    refreshImages
  };
})();

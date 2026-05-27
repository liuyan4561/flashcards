/**
 * 闪卡数据存储模块
 * 使用 LocalStorage 实现持久化
 */
const Store = (() => {
  const STORAGE_KEY = 'flashcards_data';
  const RECORDS_KEY = 'flashcards_records';

  // 默认数据结构
  function getDefaultData() {
    return {
      cards: [],      // { id, word, hint, images: [], createdAt, isNew }
      nextId: 1
    };
  }

  function getDefaultRecords() {
    return {};  // { cardId: { interval, easeFactor, nextReview, reviewCount, lastReview } }
  }

  // 读取全部闪卡
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('读取闪卡数据失败:', e);
    }
    return getDefaultData();
  }

  // 保存全部闪卡
  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // 读取复习记录
  function loadRecords() {
    try {
      const raw = localStorage.getItem(RECORDS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('读取复习记录失败:', e);
    }
    return getDefaultRecords();
  }

  // 保存复习记录
  function saveRecords(records) {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }

  return {
    // 获取所有闪卡
    getAllCards() {
      return load().cards;
    },

    // 根据 ID 获取单张闪卡
    getCard(id) {
      return load().cards.find(c => c.id === id) || null;
    },

    // 添加闪卡
    addCard(word, hint, images = []) {
      const data = load();
      const card = {
        id: data.nextId++,
        word: word.trim(),
        hint: hint.trim(),
        images: images,  // base64 或 URL 数组
        createdAt: Date.now(),
        isNew: true
      };
      data.cards.push(card);
      save(data);
      return card;
    },

    // 删除闪卡
    deleteCard(id) {
      const data = load();
      data.cards = data.cards.filter(c => c.id !== id);
      save(data);
      // 同时删除复习记录
      const records = loadRecords();
      delete records[id];
      saveRecords(records);
    },

    // 获取统计信息
    getStats() {
      const data = load();
      const total = data.cards.length;
      const newCount = data.cards.filter(c => c.isNew).length;
      const oldCount = total - newCount;
      return { total, newCount, oldCount };
    },

    // 标记闪卡为旧词（首次学习后）
    markAsOld(id) {
      const data = load();
      const card = data.cards.find(c => c.id === id);
      if (card && card.isNew) {
        card.isNew = false;
        save(data);
      }
    },

    // 获取今日需要复习的旧词
    getTodayReviewCards() {
      const cards = this.getAllCards().filter(c => !c.isNew);
      const records = loadRecords();
      const now = Date.now();

      return cards.filter(card => {
        const record = records[card.id];
        if (!record) return true; // 没有记录的需要复习
        return record.nextReview <= now;
      });
    },

    // 获取新词（用于学习）
    getNewCards() {
      return this.getAllCards().filter(c => c.isNew);
    },

    // 更新复习记录
    updateRecord(cardId, record) {
      const records = loadRecords();
      records[cardId] = record;
      saveRecords(records);
    },

    // 获取复习记录
    getRecord(cardId) {
      return loadRecords()[cardId] || null;
    },

    // 获取今日学习计划（旧词复习 + 新词学习，混合随机）
    getStudyPlan(maxOld = 20, maxNew = 10) {
      const oldCards = this.getTodayReviewCards().slice(0, maxOld);
      const newCards = this.getNewCards().slice(0, maxNew);

      // 合并并随机打乱
      const all = [...oldCards.map(c => ({ ...c, type: 'review' })), ...newCards.map(c => ({ ...c, type: 'new' }))];
      return shuffleArray(all);
    },

    // 清空所有数据
    clearAll() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RECORDS_KEY);
    }
  };
})();

// Fisher-Yates 洗牌算法
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

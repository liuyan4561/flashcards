/**
 * 间隔重复 / 遗忘曲线算法
 * 基于 SM-2 算法变体
 *
 * 三个按钮映射：
 * - "忘记了"   → 质量评分 0 → 重置间隔到 1 天
 * - "想一想"   → 质量评分 2 → 间隔保持不变（勉强记得）
 * - "记住了"   → 质量评分 4 → 间隔翻倍（轻松记住）
 */
const SpacedRepetition = (() => {

  // SM-2 算法参数
  const DEFAULT_EASE_FACTOR = 2.5;
  const MIN_EASE_FACTOR = 1.3;
  const EASE_FACTOR_DELTA = 0.15;

  // 间隔天数序列（天）
  const INTERVALS = [1, 2, 4, 7, 15, 30, 60, 120, 240];

  /**
   * 根据用户反馈计算下一次复习参数
   * @param {object} currentRecord - 当前复习记录，首次学习时为 null
   * @param {string} feedback - 'forgot' | 'think' | 'remembered'
   * @returns {object} 新的复习记录 { interval, easeFactor, nextReview, reviewCount, lastReview }
   */
  function processFeedback(currentRecord, feedback) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // 首次学习
    if (!currentRecord) {
      let interval;
      switch (feedback) {
        case 'forgot':
          interval = 1;
          break;
        case 'think':
          interval = 2;
          break;
        case 'remembered':
          interval = 4;
          break;
        default:
          interval = 1;
      }
      return {
        interval,
        easeFactor: DEFAULT_EASE_FACTOR,
        nextReview: now + interval * oneDayMs,
        reviewCount: 1,
        lastReview: now
      };
    }

    // 后续复习
    const { easeFactor, reviewCount } = currentRecord;
    let newEaseFactor = easeFactor;
    let newInterval;

    switch (feedback) {
      case 'forgot': // 质量评分 0 → 重置
        newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - EASE_FACTOR_DELTA);
        newInterval = 1; // 1 天后再复习
        break;

      case 'think': // 质量评分 2 → 保持
        newInterval = currentRecord.interval; // 保持当前间隔
        break;

      case 'remembered': // 质量评分 4 → 增加
        newEaseFactor = easeFactor + EASE_FACTOR_DELTA;
        // 使用间隔序列，找到下一个更大的间隔
        const currentIndex = INTERVALS.findIndex(i => i >= currentRecord.interval);
        if (currentIndex >= 0 && currentIndex < INTERVALS.length - 1) {
          newInterval = INTERVALS[currentIndex + 1];
        } else if (currentIndex === -1 || currentIndex >= INTERVALS.length - 1) {
          // 超出预定义序列，使用 easeFactor 乘以当前间隔
          newInterval = Math.round(currentRecord.interval * easeFactor);
        } else {
          newInterval = INTERVALS[INTERVALS.length - 1];
        }
        break;
    }

    newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor);
    newInterval = Math.max(1, newInterval);

    return {
      interval: newInterval,
      easeFactor: newEaseFactor,
      nextReview: now + newInterval * oneDayMs,
      reviewCount: reviewCount + 1,
      lastReview: now
    };
  }

  /**
   * 获取卡片状态描述
   */
  function getStatusText(record) {
    if (!record) return '新词';
    if (record.reviewCount === 0) return '新词';

    const daysUntilReview = Math.ceil((record.nextReview - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysUntilReview <= 0) return '待复习';
    return `${daysUntilReview} 天后复习`;
  }

  return {
    processFeedback,
    getStatusText
  };
})();

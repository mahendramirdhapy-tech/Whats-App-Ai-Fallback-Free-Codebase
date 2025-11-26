const { logger } = require('../utils/logger');

class PlanManager {
  constructor() {
    this.userUsage = new Map();
    this.FREE_PLAN_LIMIT = 50;
    this.PAID_PLAN_LIMIT = 1000;
    this.RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000;
  }

  getUserPlan(phoneNumber) {
    return process.env.PAID_USERS?.includes(phoneNumber) ? 'paid' : 'free';
  }

  canSendMessage(phoneNumber) {
    try {
      const plan = this.getUserPlan(phoneNumber);
      const userKey = `${phoneNumber}_${this.getCurrentWindow()}`;
      
      const usage = this.userUsage.get(userKey) || { count: 0, lastReset: Date.now() };
      
      if (Date.now() - usage.lastReset > this.RATE_LIMIT_WINDOW) {
        usage.count = 0;
        usage.lastReset = Date.now();
      }

      const limit = plan === 'paid' ? this.PAID_PLAN_LIMIT : this.FREE_PLAN_LIMIT;
      
      if (usage.count >= limit) {
        logger.warn('Rate limit exceeded:', { phoneNumber, plan, usage: usage.count });
        return false;
      }

      usage.count++;
      this.userUsage.set(userKey, usage);
      
      logger.debug('Usage updated:', { phoneNumber, plan, usage: usage.count });
      
      return true;
    } catch (error) {
      logger.error('Error checking user plan:', error);
      return false;
    }
  }

  getCurrentWindow() {
    return Math.floor(Date.now() / this.RATE_LIMIT_WINDOW);
  }

  getUserUsage(phoneNumber) {
    const plan = this.getUserPlan(phoneNumber);
    const userKey = `${phoneNumber}_${this.getCurrentWindow()}`;
    const usage = this.userUsage.get(userKey) || { count: 0, lastReset: Date.now() };
    const limit = plan === 'paid' ? this.PAID_PLAN_LIMIT : this.FREE_PLAN_LIMIT;
    
    return {
      plan,
      used: usage.count,
      limit,
      remaining: Math.max(0, limit - usage.count),
      resetTime: usage.lastReset + this.RATE_LIMIT_WINDOW
    };
  }
}

const planManager = new PlanManager();

function verifyPlanAccess(req, res, next) {
  try {
    let phoneNumber = null;

    if (req.body.entry) {
      const message = req.body.entry[0]?.changes[0]?.value?.messages?.[0];
      phoneNumber = message?.from;
    } else if (req.body.phoneNumber) {
      phoneNumber = req.body.phoneNumber;
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number not found in request' });
    }

    if (!planManager.canSendMessage(phoneNumber)) {
      const usage = planManager.getUserUsage(phoneNumber);
      
      if (req.body.entry) {
        logger.warn('Blocked webhook due to rate limit:', { phoneNumber, usage });
        return res.status(429).send('RATE_LIMIT_EXCEEDED');
      } else {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          usage
        });
      }
    }

    req.userPlan = planManager.getUserPlan(phoneNumber);
    req.userPhoneNumber = phoneNumber;
    
    next();
  } catch (error) {
    logger.error('Error in plan verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  verifyPlanAccess,
  PlanManager: planManager,
  getUserUsage: planManager.getUserUsage.bind(planManager)
};

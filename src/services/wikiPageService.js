/**
 * Wiki Page Service for Minecraft Wiki
 * 整合URL处理、内容解析和Markdown转换功能，提供完整的页面获取服务
 */

const PageUrlHandler = require('./pageUrlHandler');
const PageContentParser = require('./pageContentParser');
const HtmlToMarkdownConverter = require('./htmlToMarkdownConverter');
const { HttpClient } = require('../utils/httpClient');
const config = require('../config');
const { logger } = require('../utils/logger');

function cloneSafe(obj) {
  try {
    return structuredClone(obj);
  } catch {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }
}

class WikiPageService {
  constructor(options = {}) {
    // 服务配置
    this.options = {
      // 基础URL
      baseUrl: config.wiki.baseUrl,

      // 缓存配置
      cacheOptions: {
        enabled: true,
        ttl: 300000, // 5分钟
        maxSize: 100, // 最大缓存条目数
      },

      // HTTP配置
      httpOptions: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
      },

      // 页面解析配置
      parseOptions: {
        extractComponents: true,
        cleanContent: true,
        processImages: true,
        processLinks: true,
      },

      // Markdown转换配置
      markdownOptions: {
        preserveInfoboxes: true,
        convertTables: true,
        handleImages: true,
        processLinks: true,
      },

      ...options,
    };

    // 初始化组件
    this.urlHandler = new PageUrlHandler(this.options.baseUrl);
    this.contentParser = new PageContentParser(this.options.parseOptions);
    this.markdownConverter = new HtmlToMarkdownConverter(this.options.markdownOptions);
    this.httpClient = new HttpClient(this.options.httpOptions);

    // 初始化缓存
    this.initializeCache();
  }

  /**
   * 初始化缓存系统
   * @private
   */
  initializeCache() {
    if (!this.options.cacheOptions.enabled) {
      this.cache = null;
      return;
    }

    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheAccessTimes = new Map();
  }

  /**
   * 获取Wiki页面的完整内容
   * @param {string} pageName - 页面名称
   * @param {Object} options - 获取选项
   * @returns {Object} 页面内容结果
   */
  async getPage(pageName, options = {}) {
    try {
      if (!pageName || typeof pageName !== 'string') {
        throw new Error('页面名称必须是非空字符串');
      }

      const {
        format = 'both', // 'html', 'markdown', 'both', 'wikitext'
        useCache = true,
        forceRefresh = false,
        includeMetadata = true,
        followRedirect = true,
        title,
        ...customOptions
      } = options;
      const sectionTitle = typeof title === 'string' ? title.trim() : '';
      // 重定向跟随方式不同，缓存分开存放
      const cacheFormat = followRedirect ? format : `${format}:no-redirect`;

      // 规范化页面名称
      const normalizedPageName = this.urlHandler.normalizePageName(pageName);

      // 检查缓存（按标题过滤的结果与完整页面不同，不共用缓存）
      if (useCache && !forceRefresh && !sectionTitle) {
        const cachedResult = this._getCachedResult(normalizedPageName, cacheFormat);
        if (cachedResult) {
          logger.info('页面内容从缓存返回', { pageName: normalizedPageName });
          return cachedResult;
        }
      }

      // 构建页面URL
      const pageUrl = this.urlHandler.buildPageUrl(normalizedPageName);

      // 检查页面是否存在
      const existsResult = await this.checkPageExists(normalizedPageName, { followRedirect });
      if (!existsResult.exists) {
        return {
          success: false,
          error: {
            code: 'PAGE_NOT_FOUND',
            message: '页面不存在',
            details: { pageName: normalizedPageName, suggestions: existsResult.suggestions },
          },
          data: null,
        };
      }

      // 跟随重定向（action=parse 不会自动跟随）
      const targetPageName = (followRedirect && existsResult.redirectTarget) || normalizedPageName;
      const redirectInfo = targetPageName !== normalizedPageName
        ? { from: normalizedPageName, to: targetPageName }
        : null;

      // 如果是wikitext格式，获取页面源代码
      if (format === 'wikitext') {
        const sourceResult = await this.getPageSource(targetPageName, {
          useCache,
          forceRefresh,
          includeMetadata,
          title: sectionTitle,
        });
        if (sourceResult.success && redirectInfo) {
          sourceResult.data.redirect = redirectInfo;
        }
        return sourceResult;
      }

      // 获取页面内容（整页或指定章节，均来自 MediaWiki parse API）
      let parseData;
      let sectionInfo = null;

      if (sectionTitle) {
        const tocResult = await this._fetchTocData(targetPageName, { useCache, forceRefresh });
        if (!tocResult.success) {
          return tocResult;
        }

        const found = this._findSectionByTitle(tocResult.data.sections, sectionTitle);
        if (!found.section) {
          return {
            success: false,
            error: {
              code: 'SECTION_NOT_FOUND',
              message: `未找到标题 '${sectionTitle}'`,
              details: {
                availableTitles: tocResult.data.sections.map((item) => item.title),
              },
            },
            data: null,
          };
        }

        try {
          parseData = await this._fetchParseData(targetPageName, {
            section: found.section.index,
          });
        } catch (error) {
          if (error.wikiCode === 'missingtitle') {
            return {
              success: false,
              error: {
                code: 'PAGE_NOT_FOUND',
                message: `页面 '${normalizedPageName}' 不存在`,
                details: null,
              },
              data: null,
            };
          }
          throw error;
        }

        sectionInfo = {
          index: found.section.index,
          number: found.section.number,
          level: found.section.level,
          title: found.section.title,
          anchor: found.section.anchor,
          matches: found.matches,
        };
      } else {
        try {
          parseData = await this._fetchParseData(targetPageName);
        } catch (error) {
          if (error.wikiCode === 'missingtitle') {
            return {
              success: false,
              error: {
                code: 'PAGE_NOT_FOUND',
                message: `页面 '${normalizedPageName}' 不存在`,
                details: null,
              },
              data: null,
            };
          }
          throw error;
        }
      }

      // 解析页面内容（正文片段中无页面框架，标题/副标题/分类由 API 字段提供）
      const parseResult = this.contentParser.parsePageContent(parseData.text, {
        pageName: normalizedPageName,
        url: pageUrl,
        title: parseData.title,
        subtitle: parseData.subtitle,
        categories: parseData.categories,
      });

      if (!parseResult.success) {
        return parseResult;
      }

      // 构建结果对象
      const result = {
        success: true,
        data: {
          pageName: parseData.title || targetPageName,
          url: pageUrl,
          ...parseResult.data,
        },
      };

      if (sectionInfo) {
        result.data.section = sectionInfo;
      }
      if (redirectInfo) {
        result.data.redirect = redirectInfo;
      }

      // 根据格式要求处理内容
      if (format === 'markdown' || format === 'both') {
        const markdownResult = this.markdownConverter.convertToMarkdown(parseResult.data.content.html, {
          pageName: normalizedPageName,
        });

        if (markdownResult.success) {
          if (format === 'markdown') {
            result.data.content = {
              markdown: markdownResult.data.markdown,
              stats: markdownResult.data.stats,
            };
          } else {
            result.data.content.markdown = markdownResult.data.markdown;
            result.data.content.markdownStats = markdownResult.data.stats;
          }
        }
      }

      // 移除HTML内容（如果只需要markdown）
      if (format === 'markdown') {
        delete result.data.content.html;
        delete result.data.content.components;
      }

      // 添加元数据
      if (includeMetadata) {
        result.data.metadata = {
          fetchTime: Date.now(),
          format,
          processingTime: parseResult.data.meta.processingTime,
          ...(sectionInfo
            ? { section: sectionInfo.number }
            : { cacheKey: this._generateCacheKey(normalizedPageName, cacheFormat) }),
        };
      }

      // 缓存结果（按标题过滤的章节结果不写入整页缓存）
      if (useCache && !sectionInfo) {
        this._cacheResult(normalizedPageName, cacheFormat, result);
      }

      logger.info('页面内容获取成功', {
        pageName: normalizedPageName,
        format,
        wordCount: parseResult.data.meta.wordCount,
      });

      return result;
    } catch (error) {
      logger.error('页面获取失败', {
        pageName,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: {
          code: 'PAGE_FETCH_ERROR',
          message: error.message,
          details: null,
        },
        data: null,
      };
    }
  }

  /**
   * 检查页面是否存在
   * @param {string} pageName - 页面名称
   * @returns {Object} 存在性检查结果
   */
  async checkPageExists(pageName, options = {}) {
    try {
      const { followRedirect = true } = options;
      const apiUrl = this.urlHandler.buildApiUrl(pageName, {
        action: 'query',
        format: 'json',
        params: {
          prop: 'info',
          redirects: followRedirect ? '1' : '0',
        },
      });

      const response = await this.httpClient.get(apiUrl);

      if (!response.data || !response.data.query) {
        return { exists: false, suggestions: [] };
      }

      const pages = response.data.query.pages;
      const pageIds = Object.keys(pages);

      // 检查是否存在有效页面
      const validPages = pageIds.filter((id) => id !== '-1' && !pages[id].missing);

      if (validPages.length > 0) {
        const redirectInfo = (response.data.query.redirects || [])[0] || null;
        return {
          exists: true,
          pageInfo: pages[validPages[0]],
          redirected: Boolean(redirectInfo),
          redirectTarget: redirectInfo ? redirectInfo.to : null,
        };
      }

      // 如果页面不存在，尝试获取建议
      const suggestions = await this.getPageSuggestions(pageName);

      return { exists: false, suggestions };
    } catch (error) {
      logger.error('页面存在性检查网络错误', { pageName, error: error.message });
      throw error;
    }
  }

  /**
   * 获取页面建议
   * @param {string} pageName - 页面名称
   * @returns {Array} 建议的页面列表
   */
  async getPageSuggestions(pageName) {
    try {
      const searchUrl = `${this.options.baseUrl}/api.php`;
      const params = new URLSearchParams({
        action: 'opensearch',
        format: 'json',
        search: pageName,
        limit: '5',
        redirects: 'resolve',
      });

      const response = await this.httpClient.get(`${searchUrl}?${params}`);

      if (response.data && Array.isArray(response.data) && response.data.length >= 2) {
        return response.data[1].map((title, index) => ({
          title,
          url: response.data[3] ? response.data[3][index] : null,
        }));
      }

      return [];
    } catch (error) {
      logger.error('获取页面建议失败', { pageName, error: error.message });
      return [];
    }
  }

  /**
   * 获取页面的Wikitext源代码，支持按标题过滤
   * @param {string} pageName - 页面名称
   * @param {Object} options - 获取选项
   * @param {boolean} [options.useCache=true] - 是否使用缓存
   * @param {boolean} [options.forceRefresh=false] - 是否强制刷新
   * @param {boolean} [options.includeMetadata=true] - 是否包含元数据
   * @param {string} [options.title] - 只获取该标题（含子章节）下的内容
   * @returns {Object} 源代码获取结果
   */
  async getPageSource(pageName, options = {}) {
    try {
      const {
        useCache = true,
        forceRefresh = false,
        includeMetadata = true,
      } = options;
      const title = typeof options.title === 'string' ? options.title.trim() : '';

      // 未指定标题：返回完整源代码（保持原有行为）
      if (!title) {
        return await this._fetchFullSource(pageName, {
          useCache,
          forceRefresh,
          includeMetadata,
        });
      }

      // 通过官方 API 的章节目录定位标题
      const tocResult = await this._fetchTocData(pageName, { useCache, forceRefresh });
      if (!tocResult.success) {
        return tocResult;
      }

      const found = this._findSectionByTitle(tocResult.data.sections, title);
      if (!found.section) {
        return {
          success: false,
          error: {
            code: 'SECTION_NOT_FOUND',
            message: `未找到标题 '${title}'`,
            details: {
              availableTitles: tocResult.data.sections.map((item) => item.title),
            },
          },
          data: null,
        };
      }

      const sectionResult = await this._fetchSectionSource(pageName, found.section, {
        useCache,
        forceRefresh,
        includeMetadata,
      });

      if (sectionResult.success) {
        sectionResult.data.section = {
          index: found.section.index,
          number: found.section.number,
          level: found.section.level,
          title: found.section.title,
          anchor: found.section.anchor,
          matches: found.matches,
        };
      }

      return sectionResult;
    } catch (error) {
      logger.error('页面源代码获取失败', {
        pageName,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: {
          code: 'SOURCE_FETCH_ERROR',
          message: error.message,
          details: null,
        },
        data: null,
      };
    }
  }

  /**
   * 获取页面章节目录（基于 MediaWiki API 的 sections）
   * @param {string} pageName - 页面名称
   * @param {Object} options - { useCache, forceRefresh }
   * @returns {Object} 章节目录结果
   */
  async getPageToc(pageName, options = {}) {
    try {
      if (!pageName || typeof pageName !== 'string') {
        throw new Error('页面名称必须是非空字符串');
      }

      const { useCache = true, forceRefresh = false, followRedirect = true } = options;
      const normalizedPageName = this.urlHandler.normalizePageName(pageName);

      // 跟随重定向（action=parse 不会自动跟随）
      const existsResult = await this.checkPageExists(normalizedPageName, { followRedirect });
      if (!existsResult.exists) {
        return {
          success: false,
          error: {
            code: 'PAGE_NOT_FOUND',
            message: `页面 '${normalizedPageName}' 不存在`,
            details: { suggestions: existsResult.suggestions },
          },
          data: null,
        };
      }

      const targetPageName = (followRedirect && existsResult.redirectTarget) || normalizedPageName;
      const tocResult = await this._fetchTocData(targetPageName, { useCache, forceRefresh });
      if (!tocResult.success) {
        return tocResult;
      }

      // 对外统一展示用户请求的页面地址与重定向关系
      tocResult.data.url = this.urlHandler.buildPageUrl(normalizedPageName);
      if (targetPageName !== normalizedPageName) {
        tocResult.data.redirect = {
          from: normalizedPageName,
          to: targetPageName,
        };
      }

      return tocResult;
    } catch (error) {
      logger.error('页面目录获取失败', {
        pageName,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: {
          code: 'TOC_FETCH_ERROR',
          message: error.message,
          details: null,
        },
        data: null,
      };
    }
  }

  /**
   * 获取章节目录数据（不处理重定向，带缓存）
   * @private
   */
  async _fetchTocData(pageName, options = {}) {
    const { useCache = true, forceRefresh = false } = options;

    if (useCache && !forceRefresh) {
      const cachedResult = this._getCachedResult(pageName, 'toc');
      if (cachedResult) {
        logger.info('页面目录从缓存返回', { pageName });
        return cachedResult;
      }
    }

    let data;
    try {
      data = await this._fetchWikiApi({
        action: 'parse',
        page: pageName,
        prop: 'sections',
      });
    } catch (error) {
      if (error.wikiCode === 'missingtitle') {
        return {
          success: false,
          error: {
            code: 'PAGE_NOT_FOUND',
            message: `页面 '${pageName}' 不存在`,
            details: null,
          },
          data: null,
        };
      }
      throw error;
    }

    const parse = data.parse || {};
    const sections = (parse.sections || []).map((item) => ({
      index: Number(item.index),
      number: item.number,
      level: Number(item.level),
      toclevel: item.toclevel,
      title: item.line,
      anchor: item.anchor,
      fromTitle: item.fromtitle,
    }));

    const result = {
      success: true,
      data: {
        pageName: parse.title || pageName,
        url: this.urlHandler.buildPageUrl(pageName),
        sectionCount: sections.length,
        sections,
      },
    };

    if (useCache) {
      this._cacheResult(pageName, 'toc', result);
    }

    logger.info('页面目录获取成功', {
      pageName,
      sectionCount: sections.length,
    });

    return result;
  }

  /**
   * 获取页面完整源代码（原编辑页抓取方式，带缓存）
   * @private
   */
  async _fetchFullSource(pageName, options = {}) {
    const { useCache = true, forceRefresh = false, includeMetadata = true } = options;

    // 检查缓存
    if (useCache && !forceRefresh) {
      const cachedResult = this._getCachedResult(pageName, 'wikitext');
      if (cachedResult) {
        logger.info('页面源代码从缓存返回', { pageName });
        return cachedResult;
      }
    }

    let data;
    try {
      data = await this._fetchWikiApi({
        action: 'parse',
        page: pageName,
        prop: 'wikitext',
      });
    } catch (error) {
      if (error.wikiCode === 'missingtitle') {
        return {
          success: false,
          error: {
            code: 'PAGE_NOT_FOUND',
            message: `页面 '${pageName}' 不存在`,
            details: null,
          },
          data: null,
        };
      }
      throw error;
    }

    const parse = data.parse || {};
    const wikitext = typeof parse.wikitext === 'string' ? parse.wikitext : '';

    // 构建结果对象
    const result = {
      success: true,
      data: {
        pageName: parse.title || pageName,
        url: this.urlHandler.buildPageUrl(pageName),
        content: {
          wikitext: wikitext,
        },
        meta: {
          wordCount: wikitext.length,
        },
      },
    };

    // 添加元数据
    if (includeMetadata) {
      result.data.metadata = {
        fetchTime: Date.now(),
        format: 'wikitext',
        cacheKey: this._generateCacheKey(pageName, 'wikitext'),
      };
    }

    // 缓存结果
    if (useCache) {
      this._cacheResult(pageName, 'wikitext', result);
    }

    logger.info('页面源代码获取成功', {
      pageName,
      wordCount: wikitext.length,
    });

    return result;
  }

  /**
   * 通过 MediaWiki API 获取指定章节的源代码（含子章节），带缓存
   * @private
   */
  async _fetchSectionSource(pageName, section, options = {}) {
    const { useCache = true, forceRefresh = false, includeMetadata = true } = options;
    const cacheFormat = `wikitext:section:${section.index}`;

    if (useCache && !forceRefresh) {
      const cachedResult = this._getCachedResult(pageName, cacheFormat);
      if (cachedResult) {
        logger.info('页面章节源代码从缓存返回', { pageName, section: section.index });
        return cachedResult;
      }
    }

    const data = await this._fetchWikiApi({
      action: 'parse',
      page: pageName,
      prop: 'wikitext',
      section: section.index,
    });

    const parse = data.parse || {};
    const wikitext = typeof parse.wikitext === 'string' ? parse.wikitext : '';

    const result = {
      success: true,
      data: {
        pageName: pageName,
        url: this.urlHandler.buildPageUrl(pageName),
        content: {
          wikitext: wikitext,
        },
        meta: {
          wordCount: wikitext.length,
          section: section.number,
        },
      },
    };

    if (includeMetadata) {
      result.data.metadata = {
        fetchTime: Date.now(),
        format: 'wikitext',
        section: section.number,
        cacheKey: this._generateCacheKey(pageName, cacheFormat),
      };
    }

    if (useCache) {
      this._cacheResult(pageName, cacheFormat, result);
    }

    logger.info('页面章节源代码获取成功', {
      pageName,
      section: section.number,
      wordCount: wikitext.length,
    });

    return result;
  }

  /**
   * 在章节目录中按标题查找（忽略大小写与首尾空白）
   * @private
   * @returns {{ section: Object|null, matches: number }}
   */
  _findSectionByTitle(sections, title) {
    const needle = title.trim().toLowerCase();
    let section = null;
    let matches = 0;

    for (const item of sections) {
      if (item.title.trim().toLowerCase() === needle) {
        matches += 1;
        if (!section) {
          section = item;
        }
      }
    }

    return { section, matches };
  }

  /**
   * 通过 MediaWiki parse API 获取渲染后的正文（整页或指定章节）
   * @private
   * @param {string} pageName - 页面名称
   * @param {Object} [extraParams] - 额外参数（如 section）
   * @returns {Promise<{ title: string, subtitle: string, text: string, categories: Array<string> }>}
   */
  async _fetchParseData(pageName, extraParams = {}) {
    // section 请求不会返回整页分类；subtitle 需显式请求
    const isSection = extraParams.section !== undefined;
    const data = await this._fetchWikiApi({
      action: 'parse',
      page: pageName,
      prop: isSection ? 'text|subtitle' : 'text|categories|subtitle',
      ...extraParams,
    });

    const parse = data.parse || {};
    const categories = (parse.categories || [])
      .filter((item) => !item.hidden)
      .map((item) => item.category)
      .filter(Boolean);

    return {
      title: parse.title || pageName,
      subtitle: typeof parse.subtitle === 'string' ? parse.subtitle : '',
      text: typeof parse.text === 'string' ? parse.text : '',
      categories,
    };
  }

  /**
   * 调用 MediaWiki API
   * @private
   */
  async _fetchWikiApi(params) {
    const baseUrl = String(this.options.baseUrl || '').replace(/\/+$/, '');
    const response = await this.httpClient.get(`${baseUrl}/api.php`, {
      params: {
        ...params,
        format: 'json',
        formatversion: '2',
      },
    });

    const data = (response && response.data) || {};
    if (data.error) {
      const error = new Error(data.error.info || 'Wiki API 错误');
      error.wikiCode = data.error.code;
      throw error;
    }

    return data;
  }

  /**
   * 批量获取多个页面
   * @param {Array} pageNames - 页面名称数组
   * @param {Object} options - 获取选项
   * @returns {Object} 批量获取结果
   */
  async getPages(pageNames, options = {}) {
    if (!Array.isArray(pageNames) || pageNames.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '页面名称必须是非空数组',
          details: null,
        },
        data: null,
      };
    }

    const { concurrency = 3, ...singlePageOptions } = options;
    const results = new Map();
    const errors = [];

    // 分批处理以控制并发
    for (let i = 0; i < pageNames.length; i += concurrency) {
      const batch = pageNames.slice(i, i + concurrency);

      const batchPromises = batch.map(async (pageName) => {
        try {
          // 调试日志：检查页面名称在批量处理中的状态
          logger.debug('批量处理页面', {
            originalPageName: pageName,
            pageNameType: typeof pageName,
            pageNameLength: pageName.length,
            firstCharCode: pageName.charCodeAt(0),
          });

          const result = await this.getPage(pageName, singlePageOptions);
          results.set(pageName, result);
        } catch (error) {
          errors.push({ pageName, error: error.message });
        }
      });

      await Promise.all(batchPromises);
    }

    return {
      success: true,
      data: {
        results: Object.fromEntries(results),
        totalPages: pageNames.length,
        successCount: results.size,
        errorCount: errors.length,
        errors,
      },
    };
  }

  /**
   * 清除缓存
   * @param {string} pageName - 特定页面名称（可选）
   */
  clearCache(pageName = null) {
    if (!this.cache) return;

    if (pageName) {
      // 清除特定页面的缓存
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${pageName}:`)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
        this.cacheAccessTimes.delete(key);
      });

      logger.info('已清除页面缓存', { pageName });
    } else {
      // 清除所有缓存
      this.cache.clear();
      this.cacheTimestamps.clear();
      this.cacheAccessTimes.clear();

      logger.info('已清除所有缓存');
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    if (!this.cache) {
      return { enabled: false };
    }

    return {
      enabled: true,
      size: this.cache.size,
      maxSize: this.options.cacheOptions.maxSize,
      ttl: this.options.cacheOptions.ttl,
      oldestEntry: Math.min(...this.cacheTimestamps.values()),
      newestEntry: Math.max(...this.cacheTimestamps.values()),
    };
  }

  /**
   * 生成缓存键
   * @private
   */
  _generateCacheKey(pageName, format) {
    return `${pageName}:${format}`;
  }

  /**
   * 获取缓存结果
   * @private
   */
  _getCachedResult(pageName, format) {
    if (!this.cache) return null;

    const cacheKey = this._generateCacheKey(pageName, format);
    const cachedResult = this.cache.get(cacheKey);

    if (!cachedResult) return null;

    // 检查TTL
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (Date.now() - timestamp > this.options.cacheOptions.ttl) {
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      this.cacheAccessTimes.delete(cacheKey);
      return null;
    }

    // 更新访问时间
    this.cacheAccessTimes.set(cacheKey, Date.now());

    return cloneSafe(cachedResult);
  }

  /**
   * 缓存结果
   * @private
   */
  _cacheResult(pageName, format, result) {
    if (!this.cache) return;

    const cacheKey = this._generateCacheKey(pageName, format);

    // 检查缓存大小限制
    if (this.cache.size >= this.options.cacheOptions.maxSize) {
      this._evictOldestEntry();
    }

    this.cache.set(cacheKey, cloneSafe(result));
    this.cacheTimestamps.set(cacheKey, Date.now());
    this.cacheAccessTimes.set(cacheKey, Date.now());
  }

  /**
   * 驱逐最旧的缓存条目（LRU）
   * @private
   */
  _evictOldestEntry() {
    if (!this.cache || this.cache.size === 0) return;

    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.cacheAccessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
      this.cacheAccessTimes.delete(oldestKey);
    }
  }

  /**
   * 更新服务配置
   * @param {Object} newOptions - 新的配置选项
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };

    // 重新初始化组件
    if (newOptions.baseUrl) {
      this.urlHandler.updateConfig({ baseUrl: newOptions.baseUrl });
    }

    if (newOptions.parseOptions) {
      this.contentParser.updateOptions(newOptions.parseOptions);
    }

    if (newOptions.markdownOptions) {
      this.markdownConverter.updateOptions(newOptions.markdownOptions);
    }

    if (newOptions.httpOptions) {
      this.httpClient.updateConfig(newOptions.httpOptions);
    }

    // 重新初始化缓存
    if (newOptions.cacheOptions) {
      this.initializeCache();
    }
  }

  /**
   * 获取当前配置
   * @returns {Object} 当前配置
   */
  getOptions() {
    return { ...this.options };
  }
}

module.exports = WikiPageService;

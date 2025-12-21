/**
 * Wiki Page Service for Minecraft Wiki
 * 整合URL处理、内容解析和Markdown转换功能，提供完整的页面获取服务
 */

const PageUrlHandler = require('./pageUrlHandler');
const PageContentParser = require('./pageContentParser');
const HtmlToMarkdownConverter = require('./htmlToMarkdownConverter');
const { HttpClient } = require('../utils/httpClient');
const { logger } = require('../utils/logger');

class WikiPageService {
    constructor(options = {}) {
        // 服务配置
        this.options = {
            // 基础URL
            baseUrl: 'https://zh.minecraft.wiki',
            
            // 缓存配置
            cacheOptions: {
                enabled: true,
                ttl: 300000,  // 5分钟
                maxSize: 100  // 最大缓存条目数
            },

            // HTTP配置
            httpOptions: {
                timeout: 30000,
                maxRetries: 3,
                retryDelay: 1000
            },

            // 页面解析配置
            parseOptions: {
                extractComponents: true,
                cleanContent: true,
                processImages: true,
                processLinks: true
            },

            // Markdown转换配置
            markdownOptions: {
                preserveInfoboxes: true,
                convertTables: true,
                handleImages: true,
                processLinks: true
            },

            ...options
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
                format = 'both',          // 'html', 'markdown', 'both', 'wikitext'
                useCache = true,
                forceRefresh = false,
                includeMetadata = true,
                ...customOptions
            } = options;

            // 规范化页面名称
            const normalizedPageName = this.urlHandler.normalizePageName(pageName);
            
            // 检查缓存
            if (useCache && !forceRefresh) {
                const cachedResult = this._getCachedResult(normalizedPageName, format);
                if (cachedResult) {
                    logger.info('页面内容从缓存返回', { pageName: normalizedPageName });
                    return cachedResult;
                }
            }

            // 构建页面URL
            const pageUrl = this.urlHandler.buildPageUrl(normalizedPageName);

            // 检查页面是否存在
            const existsResult = await this.checkPageExists(normalizedPageName);
            if (!existsResult.exists) {
                return {
                    success: false,
                    error: {
                        code: 'PAGE_NOT_FOUND',
                        message: '页面不存在',
                        details: { pageName: normalizedPageName, suggestions: existsResult.suggestions }
                    },
                    data: null
                };
            }

            // 如果是wikitext格式，获取编辑页面内容
            if (format === 'wikitext') {
                return await this.getPageSource(normalizedPageName, {
                    useCache,
                    forceRefresh,
                    includeMetadata
                });
            }

            // 获取页面HTML内容
            const htmlResult = await this.fetchPageHtml(pageUrl);
            if (!htmlResult.success) {
                return htmlResult;
            }

            // 解析页面内容
            const parseResult = this.contentParser.parsePageContent(
                htmlResult.data.html,
                { pageName: normalizedPageName, url: pageUrl }
            );

            if (!parseResult.success) {
                return parseResult;
            }

            // 构建结果对象
            const result = {
                success: true,
                data: {
                    pageName: normalizedPageName,
                    url: pageUrl,
                    ...parseResult.data
                }
            };

            // 根据格式要求处理内容
            if (format === 'markdown' || format === 'both') {
                const markdownResult = this.markdownConverter.convertToMarkdown(
                    parseResult.data.content.html,
                    { pageName: normalizedPageName }
                );

                if (markdownResult.success) {
                    if (format === 'markdown') {
                        result.data.content = {
                            markdown: markdownResult.data.markdown,
                            stats: markdownResult.data.stats
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
                    cacheKey: this._generateCacheKey(normalizedPageName, format)
                };
            }

            // 缓存结果
            if (useCache) {
                this._cacheResult(normalizedPageName, format, result);
            }

            logger.info('页面内容获取成功', { 
                pageName: normalizedPageName, 
                format,
                wordCount: parseResult.data.meta.wordCount
            });

            return result;

        } catch (error) {
            logger.error('页面获取失败', { 
                pageName, 
                error: error.message,
                stack: error.stack 
            });
            
            return {
                success: false,
                error: {
                    code: 'PAGE_FETCH_ERROR',
                    message: error.message,
                    details: null
                },
                data: null
            };
        }
    }

    /**
     * 检查页面是否存在
     * @param {string} pageName - 页面名称
     * @returns {Object} 存在性检查结果
     */
    async checkPageExists(pageName) {
        try {
            const apiUrl = this.urlHandler.buildApiUrl(pageName, {
                action: 'query',
                format: 'json',
                params: {
                    prop: 'info',
                    redirects: '1'
                }
            });

            const response = await this.httpClient.get(apiUrl);
            
            if (!response.data || !response.data.query) {
                return { exists: false, suggestions: [] };
            }

            const pages = response.data.query.pages;
            const pageIds = Object.keys(pages);
            
            // 检查是否存在有效页面
            const validPages = pageIds.filter(id => id !== '-1' && !pages[id].missing);
            
            if (validPages.length > 0) {
                return { 
                    exists: true, 
                    pageInfo: pages[validPages[0]],
                    redirected: response.data.query.redirects ? true : false
                };
            }

            // 如果页面不存在，尝试获取建议
            const suggestions = await this.getPageSuggestions(pageName);
            
            return { exists: false, suggestions };

        } catch (error) {
            logger.error('页面存在性检查失败', { pageName, error: error.message });
            return { exists: false, suggestions: [] };
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
                redirects: 'resolve'
            });

            const response = await this.httpClient.get(`${searchUrl}?${params}`);
            
            if (response.data && Array.isArray(response.data) && response.data.length >= 2) {
                return response.data[1].map((title, index) => ({
                    title,
                    url: response.data[3] ? response.data[3][index] : null
                }));
            }

            return [];

        } catch (error) {
            logger.error('获取页面建议失败', { pageName, error: error.message });
            return [];
        }
    }

    /**
     * 获取页面的原始HTML内容
     * @param {string} pageUrl - 页面URL
     * @returns {Object} HTML获取结果
     */
    async fetchPageHtml(pageUrl) {
        try {
            const response = await this.httpClient.get(pageUrl);

            if (!response.data) {
                throw new Error('未收到页面内容');
            }

            return {
                success: true,
                data: {
                    html: response.data,
                    url: pageUrl,
                    fetchTime: Date.now(),
                    size: response.data.length
                }
            };

        } catch (error) {
            logger.error('页面HTML获取失败', { pageUrl, error: error.message });

            return {
                success: false,
                error: {
                    code: 'HTML_FETCH_ERROR',
                    message: error.message,
                    details: { url: pageUrl }
                },
                data: null
            };
        }
    }

    /**
     * 获取页面的Wikitext源代码
     * @param {string} pageName - 页面名称
     * @param {Object} options - 获取选项
     * @returns {Object} 源代码获取结果
     */
    async getPageSource(pageName, options = {}) {
        try {
            const {
                useCache = true,
                forceRefresh = false,
                includeMetadata = true
            } = options;

            // 检查缓存
            if (useCache && !forceRefresh) {
                const cachedResult = this._getCachedResult(pageName, 'wikitext');
                if (cachedResult) {
                    logger.info('页面源代码从缓存返回', { pageName });
                    return cachedResult;
                }
            }

            // 构建编辑页面URL
            const editUrl = this.urlHandler.buildPageUrl(pageName, { action: 'edit' });

            // 获取编辑页面HTML内容
            const htmlResult = await this.fetchPageHtml(editUrl);
            if (!htmlResult.success) {
                return htmlResult;
            }

            // 解析Wikitext源代码
            const cheerio = require('cheerio');
            const $ = cheerio.load(htmlResult.data.html);

            // 查找源代码编辑器textarea
            const wikitext = $('#wpTextbox1').text();

            if (!wikitext) {
                throw new Error('未找到Wikitext源代码');
            }

            // 构建结果对象
            const result = {
                success: true,
                data: {
                    pageName: pageName,
                    url: this.urlHandler.buildPageUrl(pageName),
                    content: {
                        wikitext: wikitext
                    },
                    meta: {
                        wordCount: wikitext.length,
                        processingTime: Date.now() - htmlResult.data.fetchTime
                    }
                }
            };

            // 添加元数据
            if (includeMetadata) {
                result.data.metadata = {
                    fetchTime: Date.now(),
                    format: 'wikitext',
                    processingTime: result.data.meta.processingTime,
                    cacheKey: this._generateCacheKey(pageName, 'wikitext')
                };
            }

            // 缓存结果
            if (useCache) {
                this._cacheResult(pageName, 'wikitext', result);
            }

            logger.info('页面源代码获取成功', {
                pageName,
                wordCount: wikitext.length
            });

            return result;

        } catch (error) {
            logger.error('页面源代码获取失败', {
                pageName,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: {
                    code: 'SOURCE_FETCH_ERROR',
                    message: error.message,
                    details: null
                },
                data: null
            };
        }
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
                    details: null
                },
                data: null
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
                        firstCharCode: pageName.charCodeAt(0)
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
                errors
            }
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
            
            keysToDelete.forEach(key => {
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
            newestEntry: Math.max(...this.cacheTimestamps.values())
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
        
        return cachedResult;
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

        this.cache.set(cacheKey, result);
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
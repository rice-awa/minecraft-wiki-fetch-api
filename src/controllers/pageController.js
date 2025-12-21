/**
 * Page API Controller
 * 处理页面内容相关的API请求
 */

const WikiPageService = require('../services/wikiPageService');
const { logger } = require('../utils/logger');

class PageController {
    constructor() {
        this.pageService = new WikiPageService();
    }

    /**
     * 获取Wiki页面内容
     * GET /api/page/:pageName
     * 
     * 路径参数:
     * - pageName: 页面名称 (必需)
     * 
     * 查询参数:
     * - format: 输出格式 (可选: html, markdown, both, 默认both)
     * - useCache: 是否使用缓存 (可选: true/false, 默认true)
     * - includeMetadata: 是否包含元数据 (可选: true/false, 默认true)
     */
    async getPage(req, res) {
        const startTime = Date.now();
        
        try {
            // 参数验证
            const validation = this.validatePageParams(req.params, req.query);
            if (!validation.isValid) {
                return this.sendErrorResponse(res, 400, 'INVALID_PARAMETERS', validation.errors.join('; '));
            }

            const { pageName } = validation.params;
            const { format, useCache, includeMetadata } = validation.query;

            // 记录请求日志
            logger.info('页面请求', {
                pageName,
                format,
                useCache,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            // 获取页面内容
            const pageResult = await this.pageService.getPage(pageName, {
                format,
                useCache,
                includeMetadata
            });

            const duration = Date.now() - startTime;

            if (pageResult.success) {
                // 成功响应
                const response = {
                    success: true,
                    data: {
                        page: pageResult.data,
                        metadata: {
                            requestTime: duration,
                            format,
                            timestamp: new Date().toISOString()
                        }
                    }
                };

                // 设置适当的HTTP头
                res.set({
                    'Cache-Control': useCache ? 'public, max-age=300' : 'no-cache',
                    'Content-Type': 'application/json; charset=utf-8'
                });

                logger.info('页面获取成功', {
                    pageName,
                    format,
                    duration,
                    wordCount: pageResult.data.meta?.wordCount || 0,
                    fromCache: pageResult.data.metadata?.cacheKey ? true : false
                });

                return res.json(response);

            } else {
                // 页面获取失败
                const statusCode = this.getStatusCodeFromError(pageResult.error.code);
                
                logger.warn('页面获取失败', {
                    pageName,
                    error: pageResult.error.message,
                    errorCode: pageResult.error.code,
                    duration
                });

                return this.sendErrorResponse(
                    res,
                    statusCode,
                    pageResult.error.code,
                    pageResult.error.message,
                    pageResult.error.details
                );
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('页面接口异常', {
                error: error.message,
                stack: error.stack,
                params: req.params,
                query: req.query,
                duration
            });

            return this.sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', '页面服务暂时不可用');
        }
    }

    /**
     * 批量获取Wiki页面内容
     * POST /api/pages
     * 
     * 请求体:
     * {
     *   "pages": ["页面1", "页面2", "页面3"],
     *   "format": "markdown",
     *   "concurrency": 3
     * }
     */
    async getPages(req, res) {
        const startTime = Date.now();
        
        try {
            // 参数验证
            const validation = this.validateBatchParams(req.body);
            if (!validation.isValid) {
                return this.sendErrorResponse(res, 400, 'INVALID_PARAMETERS', validation.errors.join('; '));
            }

            const { pages, format, concurrency, useCache } = validation.params;

            // 记录请求日志
            logger.info('批量页面请求', {
                pageCount: pages.length,
                format,
                concurrency,
                ip: req.ip
            });

            // 调试：检查页面名称在控制器中的状态
            logger.debug('批量请求页面名称调试', {
                originalBodyPages: req.body.pages,
                validatedPages: pages,
                pagesAreEqual: JSON.stringify(req.body.pages) === JSON.stringify(pages),
                firstPageName: pages[0],
                firstPageNameType: typeof pages[0],
                firstPageNameLength: pages[0].length,
                firstPageNameCharCodes: pages[0].split('').map(c => c.charCodeAt(0))
            });

            // 批量获取页面
            const batchResult = await this.pageService.getPages(pages, {
                format,
                concurrency,
                useCache
            });

            const duration = Date.now() - startTime;

            if (batchResult.success) {
                const response = {
                    success: true,
                    data: {
                        results: batchResult.data.results,
                        summary: {
                            totalPages: batchResult.data.totalPages,
                            successCount: batchResult.data.successCount,
                            errorCount: batchResult.data.errorCount
                        },
                        metadata: {
                            requestTime: duration,
                            format,
                            timestamp: new Date().toISOString()
                        }
                    }
                };

                logger.info('批量页面获取成功', {
                    totalPages: batchResult.data.totalPages,
                    successCount: batchResult.data.successCount,
                    errorCount: batchResult.data.errorCount,
                    duration
                });

                return res.json(response);

            } else {
                return this.sendErrorResponse(
                    res,
                    500,
                    'BATCH_ERROR',
                    '批量页面获取失败'
                );
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error('批量页面接口异常', {
                error: error.message,
                stack: error.stack,
                body: req.body,
                duration
            });

            return this.sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', '批量页面服务暂时不可用');
        }
    }

    /**
     * 检查页面是否存在
     * GET /api/page/:pageName/exists
     */
    async checkPageExists(req, res) {
        try {
            const { pageName } = req.params;
            
            if (!pageName || typeof pageName !== 'string') {
                return this.sendErrorResponse(res, 400, 'INVALID_PARAMETERS', '页面名称无效');
            }

            const decodedPageName = decodeURIComponent(pageName);
            
            logger.info('页面存在性检查', { pageName: decodedPageName, ip: req.ip });

            const existsResult = await this.pageService.checkPageExists(decodedPageName);
            
            const response = {
                success: true,
                data: {
                    pageName: decodedPageName,
                    exists: existsResult.exists,
                    ...(existsResult.pageInfo && { pageInfo: existsResult.pageInfo }),
                    ...(existsResult.redirected && { redirected: existsResult.redirected }),
                    ...(existsResult.suggestions && { suggestions: existsResult.suggestions })
                }
            };

            return res.json(response);

        } catch (error) {
            logger.error('页面存在性检查异常', {
                error: error.message,
                params: req.params
            });

            return this.sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', '页面检查服务暂时不可用');
        }
    }

    /**
     * 清除页面缓存
     * DELETE /api/page/:pageName/cache
     */
    async clearPageCache(req, res) {
        try {
            const { pageName } = req.params;
            
            if (pageName && pageName !== 'all') {
                const decodedPageName = decodeURIComponent(pageName);
                this.pageService.clearCache(decodedPageName);
                
                logger.info('页面缓存已清除', { pageName: decodedPageName, ip: req.ip });
                
                return res.json({
                    success: true,
                    message: `页面 "${decodedPageName}" 的缓存已清除`
                });
            } else {
                this.pageService.clearCache();
                
                logger.info('所有页面缓存已清除', { ip: req.ip });
                
                return res.json({
                    success: true,
                    message: '所有页面缓存已清除'
                });
            }

        } catch (error) {
            logger.error('清除缓存异常', {
                error: error.message,
                params: req.params
            });

            return this.sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', '缓存清除失败');
        }
    }

    /**
     * 验证页面参数
     * @private
     */
    validatePageParams(params, query) {
        const errors = [];
        const validatedParams = {};
        const validatedQuery = {};

        // 验证页面名称
        if (!params.pageName || typeof params.pageName !== 'string') {
            errors.push('页面名称不能为空');
        } else {
            try {
                validatedParams.pageName = decodeURIComponent(params.pageName);
                if (validatedParams.pageName.length > 255) {
                    errors.push('页面名称长度不能超过255个字符');
                }
            } catch (e) {
                errors.push('页面名称编码无效');
            }
        }

        // 验证格式
        const validFormats = ['html', 'markdown', 'both', 'wikitext'];
        if (query.format) {
            if (!validFormats.includes(query.format)) {
                errors.push(`format参数必须是以下值之一: ${validFormats.join(', ')}`);
            } else {
                validatedQuery.format = query.format;
            }
        } else {
            validatedQuery.format = 'both';
        }

        // 验证缓存选项
        if (query.useCache !== undefined) {
            if (query.useCache === 'true' || query.useCache === true) {
                validatedQuery.useCache = true;
            } else if (query.useCache === 'false' || query.useCache === false) {
                validatedQuery.useCache = false;
            } else {
                errors.push('useCache参数必须是true或false');
            }
        } else {
            validatedQuery.useCache = true;
        }

        // 验证元数据选项
        if (query.includeMetadata !== undefined) {
            if (query.includeMetadata === 'true' || query.includeMetadata === true) {
                validatedQuery.includeMetadata = true;
            } else if (query.includeMetadata === 'false' || query.includeMetadata === false) {
                validatedQuery.includeMetadata = false;
            } else {
                errors.push('includeMetadata参数必须是true或false');
            }
        } else {
            validatedQuery.includeMetadata = true;
        }

        return {
            isValid: errors.length === 0,
            errors,
            params: validatedParams,
            query: validatedQuery
        };
    }

    /**
     * 验证批量请求参数
     * @private
     */
    validateBatchParams(body) {
        const errors = [];
        const params = {};

        // 验证页面列表
        if (!body.pages || !Array.isArray(body.pages)) {
            errors.push('pages参数必须是数组');
        } else if (body.pages.length === 0) {
            errors.push('pages数组不能为空');
        } else if (body.pages.length > 20) {
            errors.push('一次最多只能请求20个页面');
        } else {
            params.pages = body.pages.filter(page => 
                page && typeof page === 'string' && page.trim().length > 0
            );
            if (params.pages.length !== body.pages.length) {
                errors.push('pages数组包含无效的页面名称');
            }
        }

        // 验证格式
        const validFormats = ['html', 'markdown', 'both', 'wikitext'];
        if (body.format) {
            if (!validFormats.includes(body.format)) {
                errors.push(`format参数必须是以下值之一: ${validFormats.join(', ')}`);
            } else {
                params.format = body.format;
            }
        } else {
            params.format = 'both';
        }

        // 验证并发数
        if (body.concurrency !== undefined) {
            const concurrency = parseInt(body.concurrency);
            if (isNaN(concurrency) || concurrency < 1) {
                errors.push('concurrency参数必须是大于0的整数');
            } else if (concurrency > 5) {
                errors.push('concurrency参数不能超过5');
            } else {
                params.concurrency = concurrency;
            }
        } else {
            params.concurrency = 3;
        }

        // 验证缓存选项
        params.useCache = body.useCache !== false;

        return {
            isValid: errors.length === 0,
            errors,
            params
        };
    }

    /**
     * 根据错误代码获取HTTP状态码
     * @private
     */
    getStatusCodeFromError(errorCode) {
        const statusMap = {
            'PAGE_NOT_FOUND': 404,
            'INVALID_PARAMETERS': 400,
            'HTML_FETCH_ERROR': 502,
            'PARSE_ERROR': 500,
            'CONVERSION_ERROR': 500,
            'PAGE_FETCH_ERROR': 500,
            'SOURCE_FETCH_ERROR': 500
        };

        return statusMap[errorCode] || 500;
    }

    /**
     * 发送错误响应
     * @private
     */
    sendErrorResponse(res, statusCode, errorCode, message, details = null) {
        const response = {
            success: false,
            error: {
                code: errorCode,
                message,
                details,
                timestamp: new Date().toISOString()
            }
        };

        return res.status(statusCode).json(response);
    }

    /**
     * 获取页面服务统计信息
     * GET /api/pages/stats
     */
    async getStats(req, res) {
        try {
            const cacheStats = this.pageService.getCacheStats();
            
            const response = {
                success: true,
                data: {
                    cache: cacheStats,
                    service: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        timestamp: new Date().toISOString()
                    }
                }
            };

            return res.json(response);

        } catch (error) {
            logger.error('获取页面统计失败', { error: error.message });
            return this.sendErrorResponse(res, 500, 'STATS_ERROR', '获取统计信息失败');
        }
    }
}

module.exports = PageController;
/**
 * 请求验证中间件
 * 提供各种请求验证功能
 */

const { ValidationError, InvalidParametersError, ErrorFactory } = require('../utils/errors');

/**
 * 通用参数验证器
 */
class ParamValidator {
    constructor() {
        this.errors = [];
    }

    /**
     * 验证必需参数
     */
    required(value, fieldName, customMessage = null) {
        if (value === undefined || value === null || value === '') {
            this.errors.push(customMessage || `${fieldName} 是必需参数`);
        }
        return this;
    }

    /**
     * 验证字符串类型
     */
    string(value, fieldName, options = {}) {
        if (value !== undefined && value !== null) {
            if (typeof value !== 'string') {
                this.errors.push(`${fieldName} 必须是字符串类型`);
                return this;
            }

            const { minLength, maxLength, pattern, allowEmpty = false } = options;

            if (!allowEmpty && value.trim().length === 0) {
                this.errors.push(`${fieldName} 不能为空字符串`);
            }

            if (minLength !== undefined && value.length < minLength) {
                this.errors.push(`${fieldName} 长度不能少于 ${minLength} 个字符`);
            }

            if (maxLength !== undefined && value.length > maxLength) {
                this.errors.push(`${fieldName} 长度不能超过 ${maxLength} 个字符`);
            }

            if (pattern && !pattern.test(value)) {
                this.errors.push(`${fieldName} 格式不正确`);
            }
        }
        return this;
    }

    /**
     * 验证数字类型
     */
    number(value, fieldName, options = {}) {
        if (value !== undefined && value !== null) {
            const numValue = Number(value);
            
            if (isNaN(numValue)) {
                this.errors.push(`${fieldName} 必须是有效的数字`);
                return this;
            }

            const { min, max, integer = false } = options;

            if (integer && !Number.isInteger(numValue)) {
                this.errors.push(`${fieldName} 必须是整数`);
            }

            if (min !== undefined && numValue < min) {
                this.errors.push(`${fieldName} 不能小于 ${min}`);
            }

            if (max !== undefined && numValue > max) {
                this.errors.push(`${fieldName} 不能大于 ${max}`);
            }
        }
        return this;
    }

    /**
     * 验证布尔类型
     */
    boolean(value, fieldName) {
        if (value !== undefined && value !== null) {
            if (typeof value === 'string') {
                if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
                    this.errors.push(`${fieldName} 必须是 true 或 false`);
                }
            } else if (typeof value !== 'boolean') {
                this.errors.push(`${fieldName} 必须是布尔类型`);
            }
        }
        return this;
    }

    /**
     * 验证数组类型
     */
    array(value, fieldName, options = {}) {
        if (value !== undefined && value !== null) {
            if (!Array.isArray(value)) {
                this.errors.push(`${fieldName} 必须是数组类型`);
                return this;
            }

            const { minLength, maxLength, itemValidator } = options;

            if (minLength !== undefined && value.length < minLength) {
                this.errors.push(`${fieldName} 至少包含 ${minLength} 个元素`);
            }

            if (maxLength !== undefined && value.length > maxLength) {
                this.errors.push(`${fieldName} 最多包含 ${maxLength} 个元素`);
            }

            if (itemValidator && typeof itemValidator === 'function') {
                value.forEach((item, index) => {
                    try {
                        itemValidator(item, `${fieldName}[${index}]`);
                    } catch (error) {
                        this.errors.push(error.message);
                    }
                });
            }
        }
        return this;
    }

    /**
     * 验证枚举值
     */
    enum(value, fieldName, allowedValues, caseSensitive = true) {
        if (value !== undefined && value !== null) {
            const checkValue = caseSensitive ? value : value.toString().toLowerCase();
            const checkAllowed = caseSensitive ? allowedValues : allowedValues.map(v => v.toLowerCase());
            
            if (!checkAllowed.includes(checkValue)) {
                this.errors.push(`${fieldName} 必须是以下值之一: ${allowedValues.join(', ')}`);
            }
        }
        return this;
    }

    /**
     * 验证邮箱格式
     */
    email(value, fieldName) {
        if (value !== undefined && value !== null && value !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                this.errors.push(`${fieldName} 必须是有效的邮箱地址`);
            }
        }
        return this;
    }

    /**
     * 验证URL格式
     */
    url(value, fieldName, options = {}) {
        if (value !== undefined && value !== null && value !== '') {
            try {
                const url = new URL(value);
                const { protocols = ['http:', 'https:'] } = options;
                
                if (!protocols.includes(url.protocol)) {
                    this.errors.push(`${fieldName} 协议必须是 ${protocols.join(' 或 ')}`);
                }
            } catch (error) {
                this.errors.push(`${fieldName} 必须是有效的URL地址`);
            }
        }
        return this;
    }

    /**
     * 自定义验证函数
     */
    custom(value, fieldName, validatorFn, errorMessage) {
        if (value !== undefined && value !== null) {
            try {
                const isValid = validatorFn(value);
                if (!isValid) {
                    this.errors.push(errorMessage || `${fieldName} 验证失败`);
                }
            } catch (error) {
                this.errors.push(errorMessage || `${fieldName} 验证出错: ${error.message}`);
            }
        }
        return this;
    }

    /**
     * 获取验证结果
     */
    getResult() {
        return {
            isValid: this.errors.length === 0,
            errors: this.errors
        };
    }

    /**
     * 抛出验证错误（如果有）
     */
    validate() {
        if (this.errors.length > 0) {
            throw new ValidationError('参数验证失败', { errors: this.errors });
        }
    }
}

/**
 * 搜索参数验证中间件
 */
function validateSearchParams(req, res, next) {
    try {
        const validator = new ParamValidator();
        const { q, limit, namespaces, format, pretty } = req.query;

        // 验证搜索关键词
        validator
            .required(q, '搜索关键词 (q)')
            .string(q, '搜索关键词 (q)', { minLength: 1, maxLength: 200 });

        // 验证结果限制
        if (limit !== undefined) {
            validator.number(limit, '结果限制 (limit)', { min: 1, max: 50, integer: true });
        }

        // 验证命名空间
        if (namespaces !== undefined) {
            validator.string(namespaces, '命名空间 (namespaces)', { allowEmpty: true });
        }

        // 验证格式
        if (format !== undefined) {
            validator.enum(format, '响应格式 (format)', ['json'], false);
        }

        // 验证JSON格式化参数
        if (pretty !== undefined) {
            validator.enum(pretty, 'JSON格式化 (pretty)', ['true', 'false', '1', '0', 'yes', 'no'], false);
        }

        validator.validate();
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * 页面参数验证中间件
 */
function validatePageParams(req, res, next) {
    try {
        const validator = new ParamValidator();
        const { pageName } = req.params;
        const { format, useCache, includeMetadata, pretty } = req.query;

        // 验证页面名称
        validator
            .required(pageName, '页面名称')
            .string(pageName, '页面名称', { minLength: 1, maxLength: 255 });

        // 验证格式
        if (format !== undefined) {
            validator.enum(format, '输出格式 (format)', ['html', 'markdown', 'both', 'wikitext'], false);
        }

        // 验证缓存选项
        if (useCache !== undefined) {
            validator.boolean(useCache, '缓存选项 (useCache)');
        }

        // 验证元数据选项
        if (includeMetadata !== undefined) {
            validator.boolean(includeMetadata, '元数据选项 (includeMetadata)');
        }

        // 验证JSON格式化参数
        if (pretty !== undefined) {
            validator.enum(pretty, 'JSON格式化 (pretty)', ['true', 'false', '1', '0', 'yes', 'no'], false);
        }

        validator.validate();
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * 批量页面参数验证中间件
 */
function validateBatchPageParams(req, res, next) {
    try {
        const validator = new ParamValidator();
        const { pages, format, concurrency, useCache } = req.body;

        // 验证页面列表
        validator
            .required(pages, '页面列表 (pages)')
            .array(pages, '页面列表 (pages)', { 
                minLength: 1, 
                maxLength: 20,
                itemValidator: (item, fieldName) => {
                    if (typeof item !== 'string' || item.trim().length === 0) {
                        throw new Error(`${fieldName} 必须是非空字符串`);
                    }
                    if (item.length > 255) {
                        throw new Error(`${fieldName} 长度不能超过255个字符`);
                    }
                }
            });

        // 验证格式
        if (format !== undefined) {
            validator.enum(format, '输出格式 (format)', ['html', 'markdown', 'both', 'wikitext'], false);
        }

        // 验证并发数
        if (concurrency !== undefined) {
            validator.number(concurrency, '并发数 (concurrency)', { min: 1, max: 5, integer: true });
        }

        // 验证缓存选项
        if (useCache !== undefined) {
            validator.boolean(useCache, '缓存选项 (useCache)');
        }

        validator.validate();
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * 分页参数验证中间件
 */
function validatePaginationParams(req, res, next) {
    try {
        const validator = new ParamValidator();
        const { page, limit, offset } = req.query;

        // 验证页码
        if (page !== undefined) {
            validator.number(page, '页码 (page)', { min: 1, integer: true });
        }

        // 验证限制数量
        if (limit !== undefined) {
            validator.number(limit, '每页数量 (limit)', { min: 1, max: 100, integer: true });
        }

        // 验证偏移量
        if (offset !== undefined) {
            validator.number(offset, '偏移量 (offset)', { min: 0, integer: true });
        }

        validator.validate();
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * 内容类型验证中间件
 */
function validateContentType(allowedTypes = ['application/json']) {
    return (req, res, next) => {
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const contentType = req.get('Content-Type');
            
            if (!contentType) {
                return next(new InvalidParametersError('缺少 Content-Type 头'));
            }

            const baseContentType = contentType.split(';')[0].trim();
            
            if (!allowedTypes.includes(baseContentType)) {
                return next(new InvalidParametersError(
                    `不支持的 Content-Type: ${baseContentType}`,
                    { allowedTypes }
                ));
            }
        }
        
        next();
    };
}

/**
 * 请求大小验证中间件
 */
function validateRequestSize(maxSize = '10mb') {
    return (req, res, next) => {
        const contentLength = req.get('Content-Length');
        
        if (contentLength) {
            const sizeLimit = parseSize(maxSize);
            
            if (parseInt(contentLength) > sizeLimit) {
                return next(new InvalidParametersError(
                    `请求体过大，最大允许 ${maxSize}`,
                    { maxSize, currentSize: contentLength }
                ));
            }
        }
        
        next();
    };
}

/**
 * 辅助函数：解析大小字符串
 */
function parseSize(sizeStr) {
    const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    
    if (!match) {
        throw new Error(`Invalid size format: ${sizeStr}`);
    }
    
    const [, size, unit = 'b'] = match;
    return parseFloat(size) * units[unit];
}

module.exports = {
    ParamValidator,
    validateSearchParams,
    validatePageParams,
    validateBatchPageParams,
    validatePaginationParams,
    validateContentType,
    validateRequestSize
};
import { Injectable, NestInterceptor, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { isObject } from '@nestjs/common/utils/shared.utils';

import { ObjectLiteral, FilterParamParsed, CrudOptions, RestfulOptions } from '../interfaces';
import { PARSED_PARAMS_REQUEST_KEY, PARSED_OPTIONS_METADATA } from '../constants';

export function RestfulParamsInterceptorFactory(crudOptions: CrudOptions): Function {
  @Injectable()
  class RestfulParamsInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, call$: Observable<any>) {
      const req = context.switchToHttp().getRequest();

      const { parsedParams, options } = await this.transform(req.params);

      req[PARSED_PARAMS_REQUEST_KEY] = parsedParams;
      req[PARSED_OPTIONS_METADATA] = options;

      return call$;
    }

    private async transform(
      params: ObjectLiteral,
    ): Promise<{ options: RestfulOptions; parsedParams: FilterParamParsed }> {
      const transformed: any = {};
      const keys = isObject(params) ? Object.keys(params) : [];

      if (keys.length) {
        // parse params
        transformed.parsedParams = keys.map(
          (key) =>
            <FilterParamParsed>{
              field: key,
              operator: 'eq',
              value: this.validate(key, crudOptions.params[key], params[key]),
            },
        );
      } else {
        transformed.parsedParams = [];
      }

      // parseOptions
      transformed.options = this.parseOptions(transformed.parsedParams);

      return transformed;
    }

    /**
     * Validate params
     * @param params
     */
    private validate(key: string, type: 'number' | 'string' | 'uuid', value: string): any {
      switch (type) {
        // is number
        case 'number':
          const isNumeric =
            'string' === typeof value && !isNaN(parseFloat(value)) && isFinite(value as any);

          if (!isNumeric) {
            throw new BadRequestException(
              `Validation failed. Param '${key}': numeric string is expected`,
            );
          }

          return parseInt(value, 10);

        // is UUID
        case 'uuid':
          const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          if (!uuid.test(value)) {
            throw new BadRequestException(
              `Validation failed. Param '${key}': UUID string is expected`,
            );
          }

          return value;

        // is string
        default:
          return value;
      }
    }

    /**
     * Parse options
     * @param parsedParams
     */
    private parseOptions(parsedParams: FilterParamParsed[]): RestfulOptions {
      const options = <RestfulOptions>Object.assign({}, crudOptions.options || {});
      const optionsFilter = options.filter || [];
      const filter = [...optionsFilter, ...parsedParams];

      if (filter.length) {
        options.filter = filter;
      }

      return options;
    }
  }

  return RestfulParamsInterceptor;
}

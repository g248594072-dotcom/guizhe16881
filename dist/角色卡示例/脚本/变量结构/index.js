import * as __WEBPACK_EXTERNAL_MODULE_https_testingcf_jsdelivr_net_gh_StageDog_tavern_resource_dist_util_mvu_zod_js_8998c919__ from "https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js";

var __webpack_modules__ = {
  "./示例/角色卡示例/schema.ts"(__unused_webpack_module, __webpack_exports__, __webpack_require__) {
    eval("{/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Schema: () => (/* binding */ Schema)\n/* harmony export */ });\n/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! zod */ \"zod\");\n/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(zod__WEBPACK_IMPORTED_MODULE_0__);\n\nconst Schema = zod__WEBPACK_IMPORTED_MODULE_0__.z.object({\n    世界: zod__WEBPACK_IMPORTED_MODULE_0__.z.object({\n        当前时间: zod__WEBPACK_IMPORTED_MODULE_0__.z.string(),\n        当前地点: zod__WEBPACK_IMPORTED_MODULE_0__.z.string(),\n        近期事务: zod__WEBPACK_IMPORTED_MODULE_0__.z.record(zod__WEBPACK_IMPORTED_MODULE_0__.z.string().describe('事务名'), zod__WEBPACK_IMPORTED_MODULE_0__.z.string().describe('事务描述')),\n    }),\n    白娅: zod__WEBPACK_IMPORTED_MODULE_0__.z\n        .object({\n        依存度: zod__WEBPACK_IMPORTED_MODULE_0__.z.coerce.number().transform(v => _.clamp(v, 0, 100)),\n        着装: zod__WEBPACK_IMPORTED_MODULE_0__.z.record(zod__WEBPACK_IMPORTED_MODULE_0__.z.enum(['上装', '下装', '内衣', '袜子', '鞋子', '饰品']), zod__WEBPACK_IMPORTED_MODULE_0__.z.string().describe('服装描述')),\n        称号: zod__WEBPACK_IMPORTED_MODULE_0__.z.record(zod__WEBPACK_IMPORTED_MODULE_0__.z.string().describe('称号名'), zod__WEBPACK_IMPORTED_MODULE_0__.z.object({\n            效果: zod__WEBPACK_IMPORTED_MODULE_0__.z.string(),\n            自我评价: zod__WEBPACK_IMPORTED_MODULE_0__.z.string(),\n        })),\n    })\n        .transform(data => {\n        const $依存度阶段 = data.依存度 < 20\n            ? '消极自毁'\n            : data.依存度 < 40\n                ? '渴求注视'\n                : data.依存度 < 60\n                    ? '暗中靠近'\n                    : data.依存度 < 80\n                        ? '忐忑相依'\n                        : '柔软依存';\n        data.称号 = _(data.称号)\n            .entries()\n            .takeRight(Math.ceil(data.依存度 / 10))\n            .fromPairs()\n            .value();\n        return { ...data, $依存度阶段 };\n    }),\n    主角: zod__WEBPACK_IMPORTED_MODULE_0__.z.object({\n        物品栏: zod__WEBPACK_IMPORTED_MODULE_0__.z\n            .record(zod__WEBPACK_IMPORTED_MODULE_0__.z.string().describe('物品名'), zod__WEBPACK_IMPORTED_MODULE_0__.z.object({\n            描述: zod__WEBPACK_IMPORTED_MODULE_0__.z.string(),\n            数量: zod__WEBPACK_IMPORTED_MODULE_0__.z.coerce.number(),\n        }))\n            .transform(data => _.pickBy(data, ({ 数量 }) => 数量 > 0)),\n    }),\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi/npLrkvosv6KeS6Imy5Y2h56S65L6LL3NjaGVtYS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlcyI6WyJzcmM6Ly90YXZlcm5faGVscGVyX3RlbXBsYXRlL+ekuuS+iy/op5LoibLljaHnpLrkvosvc2NoZW1hLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBTY2hlbWEgPSB6Lm9iamVjdCh7XG4gICAg5LiW55WMOiB6Lm9iamVjdCh7XG4gICAgICAgIOW9k+WJjeaXtumXtDogei5zdHJpbmcoKSxcbiAgICAgICAg5b2T5YmN5Zyw54K5OiB6LnN0cmluZygpLFxuICAgICAgICDov5HmnJ/kuovliqE6IHoucmVjb3JkKHouc3RyaW5nKCkuZGVzY3JpYmUoJ+S6i+WKoeWQjScpLCB6LnN0cmluZygpLmRlc2NyaWJlKCfkuovliqHmj4/ov7AnKSksXG4gICAgfSksXG4gICAg55m95aiFOiB6XG4gICAgICAgIC5vYmplY3Qoe1xuICAgICAgICDkvp3lrZjluqY6IHouY29lcmNlLm51bWJlcigpLnRyYW5zZm9ybSh2ID0+IF8uY2xhbXAodiwgMCwgMTAwKSksXG4gICAgICAgIOedgOijhTogei5yZWNvcmQoei5lbnVtKFsn5LiK6KOFJywgJ+S4i+ijhScsICflhoXooaMnLCAn6KKc5a2QJywgJ+mei+WtkCcsICfppbDlk4EnXSksIHouc3RyaW5nKCkuZGVzY3JpYmUoJ+acjeijheaPj+i/sCcpKSxcbiAgICAgICAg56ew5Y+3OiB6LnJlY29yZCh6LnN0cmluZygpLmRlc2NyaWJlKCfnp7Dlj7flkI0nKSwgei5vYmplY3Qoe1xuICAgICAgICAgICAg5pWI5p6cOiB6LnN0cmluZygpLFxuICAgICAgICAgICAg6Ieq5oiR6K+E5Lu3OiB6LnN0cmluZygpLFxuICAgICAgICB9KSksXG4gICAgfSlcbiAgICAgICAgLnRyYW5zZm9ybShkYXRhID0+IHtcbiAgICAgICAgY29uc3QgJOS+neWtmOW6pumYtuautSA9IGRhdGEu5L6d5a2Y5bqmIDwgMjBcbiAgICAgICAgICAgID8gJ+a2iOaegeiHquavgSdcbiAgICAgICAgICAgIDogZGF0YS7kvp3lrZjluqYgPCA0MFxuICAgICAgICAgICAgICAgID8gJ+a4tOaxguazqOinhidcbiAgICAgICAgICAgICAgICA6IGRhdGEu5L6d5a2Y5bqmIDwgNjBcbiAgICAgICAgICAgICAgICAgICAgPyAn5pqX5Lit6Z2g6L+RJ1xuICAgICAgICAgICAgICAgICAgICA6IGRhdGEu5L6d5a2Y5bqmIDwgODBcbiAgICAgICAgICAgICAgICAgICAgICAgID8gJ+W/kOW/keebuOS+nSdcbiAgICAgICAgICAgICAgICAgICAgICAgIDogJ+aflOi9r+S+neWtmCc7XG4gICAgICAgIGRhdGEu56ew5Y+3ID0gXyhkYXRhLuensOWPtylcbiAgICAgICAgICAgIC5lbnRyaWVzKClcbiAgICAgICAgICAgIC50YWtlUmlnaHQoTWF0aC5jZWlsKGRhdGEu5L6d5a2Y5bqmIC8gMTApKVxuICAgICAgICAgICAgLmZyb21QYWlycygpXG4gICAgICAgICAgICAudmFsdWUoKTtcbiAgICAgICAgcmV0dXJuIHsgLi4uZGF0YSwgJOS+neWtmOW6pumYtuautSB9O1xuICAgIH0pLFxuICAgIOS4u+inkjogei5vYmplY3Qoe1xuICAgICAgICDnianlk4HmoI86IHpcbiAgICAgICAgICAgIC5yZWNvcmQoei5zdHJpbmcoKS5kZXNjcmliZSgn54mp5ZOB5ZCNJyksIHoub2JqZWN0KHtcbiAgICAgICAgICAgIOaPj+i/sDogei5zdHJpbmcoKSxcbiAgICAgICAgICAgIOaVsOmHjzogei5jb2VyY2UubnVtYmVyKCksXG4gICAgICAgIH0pKVxuICAgICAgICAgICAgLnRyYW5zZm9ybShkYXRhID0+IF8ucGlja0J5KGRhdGEsICh7IOaVsOmHjyB9KSA9PiDmlbDph48gPiAwKSksXG4gICAgfSksXG59KTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./示例/角色卡示例/schema.ts\n\n}");
  },
  "./示例/角色卡示例/脚本/变量结构/index.ts"(__unused_webpack_module, __unused_webpack___webpack_exports__, __webpack_require__) {
    eval('{/* harmony import */ var https_testingcf_jsdelivr_net_gh_StageDog_tavern_resource_dist_util_mvu_zod_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js */ "https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js");\n/* harmony import */ var _schema__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../schema */ "./示例/角色卡示例/schema.ts");\n\n\n$(() => {\n    (0,https_testingcf_jsdelivr_net_gh_StageDog_tavern_resource_dist_util_mvu_zod_js__WEBPACK_IMPORTED_MODULE_0__.registerMvuSchema)(_schema__WEBPACK_IMPORTED_MODULE_1__.Schema);\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi/npLrkvosv6KeS6Imy5Y2h56S65L6LL+iEmuacrC/lj5jph4/nu5PmnoQvaW5kZXgudHMiLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBRUE7QUFDQTtBQUNBIiwic291cmNlcyI6WyJzcmM6Ly90YXZlcm5faGVscGVyX3RlbXBsYXRlL+ekuuS+iy/op5LoibLljaHnpLrkvosv6ISa5pysL+WPmOmHj+e7k+aehC9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZWdpc3Rlck12dVNjaGVtYSB9IGZyb20gJ2h0dHBzOi8vdGVzdGluZ2NmLmpzZGVsaXZyLm5ldC9naC9TdGFnZURvZy90YXZlcm5fcmVzb3VyY2UvZGlzdC91dGlsL212dV96b2QuanMnO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi4vLi4vc2NoZW1hJztcblxuJCgoKSA9PiB7XG4gIHJlZ2lzdGVyTXZ1U2NoZW1hKFNjaGVtYSk7XG59KTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./示例/角色卡示例/脚本/变量结构/index.ts\n\n}');
  },
  "https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js"(module, __unused_webpack_exports, __webpack_require__) {
    var x = y => {
      var x = {};
      __webpack_require__.d(x, y);
      return x;
    };
    var y = x => () => x;
    module.exports = x({
      ["registerMvuSchema"]: () => __WEBPACK_EXTERNAL_MODULE_https_testingcf_jsdelivr_net_gh_StageDog_tavern_resource_dist_util_mvu_zod_js_8998c919__.registerMvuSchema
    });
  },
  zod(module) {
    module.exports = z;
  }
};

var __webpack_module_cache__ = {};

function __webpack_require__(moduleId) {
  var cachedModule = __webpack_module_cache__[moduleId];
  if (cachedModule !== undefined) {
    return cachedModule.exports;
  }
  var module = __webpack_module_cache__[moduleId] = {
    exports: {}
  };
  if (!(moduleId in __webpack_modules__)) {
    delete __webpack_module_cache__[moduleId];
    var e = new Error("Cannot find module '" + moduleId + "'");
    e.code = "MODULE_NOT_FOUND";
    throw e;
  }
  __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  return module.exports;
}

(() => {
  __webpack_require__.n = module => {
    var getter = module && module.__esModule ? () => module["default"] : () => module;
    __webpack_require__.d(getter, {
      a: getter
    });
    return getter;
  };
})();

(() => {
  __webpack_require__.d = (exports, definition) => {
    for (var key in definition) {
      if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
        Object.defineProperty(exports, key, {
          enumerable: true,
          get: definition[key]
        });
      }
    }
  };
})();

(() => {
  __webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
})();

var __webpack_exports__ = __webpack_require__("./示例/角色卡示例/脚本/变量结构/index.ts");
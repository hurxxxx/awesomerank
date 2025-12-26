module.exports = {
    defaultNamespace: 'translation',
    keySeparator: false,
    namespaceSeparator: false,
    lexers: {
        ts: ['JavascriptLexer'],
        tsx: ['JsxLexer'],
        js: ['JavascriptLexer'],
        jsx: ['JsxLexer'],
        default: ['JavascriptLexer'],
    },
    locales: ['en', 'ko', 'es', 'pt'],
    output: 'src/locales/$LOCALE.json',
    input: ['src/**/*.{ts,tsx}'],
    sort: (a, b) => a.localeCompare(b),
    useKeysAsDefaultValue: false, // 새 키 추가 시 빈 값으로 생성 (번역 누락 파악 용이)
    verbose: true,
    createOldCatalogs: false,
    keepRemoved: false, // 사용하지 않는 키 자동 제거
};

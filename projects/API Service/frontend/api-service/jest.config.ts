export default {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["@testing-library/jest-dom"],
    testEnvironmentOptions: {
        customExportConditions: [""]
    },
    globals: {
        TextEncoder: "TextEncoder"
    },
    moduleNameMapper: {
        "\\.(css|less|scss)$": "<rootDir>/__mocks__/fileMock.js",
        "\\.(jpg|jpeg|png|svg)$": "<rootDir>/__mocks__/fileMock.js"
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {
            tsconfig: {
                jsx: "react-jsx",
                verbatimModuleSyntax: false,
                esModuleInterop: true
            }
        }]
    },
    setupFiles: ["<rootDir>/jest.setup.js"]
    
}
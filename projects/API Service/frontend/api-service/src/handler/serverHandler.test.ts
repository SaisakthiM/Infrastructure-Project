import {serverCheck} from "./serverHandler"

import '@testing-library/jest-dom';

import axios from "axios"

jest.mock("axios")
const mockedAxios = axios as jest.Mocked<typeof axios>


describe("serverUtils", () => {
    test("return true if server not running", async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: {} })
        const result = await serverCheck();
        expect(result).toBe(true)
    })
    test("return false if server is down", async () => {
        mockedAxios.get.mockResolvedValue(new Error("network down"))
        const result = await serverCheck();
        expect(result).toBe(false)
    })
    test("calls correct endpoint", async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: {} })
        await serverCheck()
        expect(mockedAxios.get).toHaveBeenCalledWith("/api-service/api/")
    })
})


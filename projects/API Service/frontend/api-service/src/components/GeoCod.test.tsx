// Rendering
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Jest DOM matchers (toBeInTheDocument, toBeVisible etc)
import '@testing-library/jest-dom';

// The component you're testing
import { GeoCod } from '../components/GeoCod';

// Mock axios
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;



describe("GeoCod Component", () => {

    // State 1 : The Server is not Running

    test("shows checking server on initial render", () => {
        // mock axios so it never resolves (stays pending)
        mockedAxios.get.mockReturnValue(new Promise(() => {}));

        render(<GeoCod />);

        expect(screen.getByText("Checking server...")).toBeInTheDocument();
    });

    // State 2 : Server is Running 

    test("shows form after server is online", async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
        render(<GeoCod/>)
        await waitFor(() => {
            expect(screen.getByText("Geocoding API", {exact: false})).toBeInTheDocument()
            expect(screen.getByText("City Name")).toBeInTheDocument()
        })
    })

    // State 3 : Server is not running

    test("shows server not found when offline", async () => {
        mockedAxios.get.mockRejectedValue(new Error("Network error"))
        render(<GeoCod/>)
        await waitFor(() => {
            expect(screen.getByText("Server Not Found")).toBeInTheDocument()
        })
    })

    // Functionality Tests

    test("typing in city input updates value", async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
        render(<GeoCod/>)

        // 1. Wait for form to appear
        await waitFor(() => {
            expect(screen.getByPlaceholderText("e.g. Chennai")).toBeInTheDocument()
        })

        // 2. Type in input
        fireEvent.change(screen.getByPlaceholderText("e.g. Chennai"), {
            target: { value: "Chennai" }
        })

        // 3. Assert input has value
        expect(screen.getByPlaceholderText("e.g. Chennai")).toHaveValue("Chennai")
    })

    test("shows error when location not found", async () => {
        mockedAxios.get
            .mockResolvedValueOnce({ status: 200, data: {} })
            .mockResolvedValueOnce({ data: [] })

        render(<GeoCod/>)

        // 1. Wait for form
        await waitFor(() => {
            expect(screen.getByPlaceholderText("e.g. Chennai")).toBeInTheDocument()
        })

        // 2. Type and submit
        fireEvent.change(screen.getByPlaceholderText("e.g. Chennai"), {
            target: { value: "asdf" }
        })
        fireEvent.change(screen.getByPlaceholderText("e.g. TN (optional)"), {
            target: { value: "asdf" }
        })
        fireEvent.change(screen.getByPlaceholderText("e.g. IN"), {
            target: { value: "asdf" }
        })
        fireEvent.click(screen.getByDisplayValue("Submit"))

        // 3. Wait for error to appear
        await waitFor(() => {
            expect(screen.getByText("Location not found. Check your inputs.")).toBeInTheDocument()
        })
    })

    test("shows results when geocoding succeeds", async () => {
        mockedAxios.get
            .mockResolvedValueOnce({ status: 200, data: {} })
            .mockResolvedValueOnce({ data: [{
                lat: 13.0836,
                lon: 80.2705,
                name: "Chennai",
                country: "IN",
                state: "Tamil Nadu"
            }]})

        render(<GeoCod/>)

        // 1. Wait for form
        await waitFor(() => {
            expect(screen.getByPlaceholderText("e.g. Chennai")).toBeInTheDocument()
        })

        // 2. Type and submit
        fireEvent.change(screen.getByPlaceholderText("e.g. Chennai"), {
            target: { value: "Chennai" }
        })
        fireEvent.change(screen.getByPlaceholderText("e.g. TN (optional)"), {
            target: { value: "Tamil Nadu" }
        })
        fireEvent.change(screen.getByPlaceholderText("e.g. IN"), {
            target: { value: "IN" }
        })
        fireEvent.click(screen.getByDisplayValue("Submit"))

        // 3. Wait for result
        await waitFor(() => {
            expect(screen.getByText("Chennai", {exact: false})).toBeInTheDocument()
        })
    })
});


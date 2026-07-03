// Rendering
import { fireEvent, render, screen, waitFor} from '@testing-library/react';

// Jest DOM matchers (toBeInTheDocument, toBeVisible etc)
import '@testing-library/jest-dom';

// The component you're testing
import { Weather } from '../components/Weather';

// Mock axios
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;



describe("Weather Component", () => {

    // State 1 : The Server is not Running

    test("shows checking server on initial render", () => {
        // mock axios so it never resolves (stays pending)
        mockedAxios.get.mockReturnValue(new Promise(() => {}));

        render(<Weather />);

        expect(screen.getByText("Checking server...")).toBeInTheDocument();
    });

    // State 2 : Server is Running 

    test("shows form after server is online", async () => {
        mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
        render(<Weather/>)
        await waitFor(() => {
            expect(screen.getByText("Weather API")).toBeInTheDocument()
            expect(screen.getByText("Latitude")).toBeInTheDocument()
        })
    })

    // State 3 : Server is not running

    test("shows server not found when offline", async () => {
        mockedAxios.get.mockRejectedValue(new Error("Network error"))
        render(<Weather/>)
        await waitFor(() => {
            expect(screen.getByText("Server Not Found")).toBeInTheDocument()
        })
    
    })

    // Functionality Tests

    test("submit fails shows error message", async () => {
        mockedAxios.get
            .mockResolvedValueOnce({ status: 200, data: {} })
            .mockRejectedValueOnce(new Error("Network error"))

        render(<Weather/>)
        await waitFor(() => {
            expect(screen.getByPlaceholderText("e.g. 13.0836")).toBeInTheDocument()
        })

        fireEvent.change(screen.getByPlaceholderText("e.g. 13.0836"), {
            target: { value: "13.0836" }
        })
        fireEvent.change(screen.getByPlaceholderText("e.g. 80.2705"), {
            target: { value: "80.2705" }
        })
        fireEvent.click(screen.getByDisplayValue("Submit"))

        await waitFor(() => {
            expect(screen.getByText("Request failed. Check your coordinates.")).toBeInTheDocument()
        })
    })

    test("correct coordinates shows weather data", async () => {
        mockedAxios.get
            .mockResolvedValueOnce({ status: 200, data: {} })
            .mockResolvedValueOnce({ data: {
                name: "Chennai",
                main: { temp: 32, feels_like: 35, humidity: 70 },
                weather: [{ description: "clear sky" }],
                wind: { speed: 5 }
            }})

        render(<Weather/>)
        await waitFor(() => {
            expect(screen.getByPlaceholderText("e.g. 13.0836")).toBeInTheDocument()
        })

        fireEvent.change(screen.getByPlaceholderText("e.g. 13.0836"), {
            target: { value: "13.0836" }
        })
        fireEvent.change(screen.getByPlaceholderText("e.g. 80.2705"), {
            target: { value: "80.2705" }
        })
        fireEvent.click(screen.getByDisplayValue("Submit"))

        await waitFor(() => {
            expect(screen.getByText("Chennai", { exact: false })).toBeInTheDocument()
        })
        })
});


// Rendering
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom';

import { Home } from '../components/Home';

describe("Home Component", () => {

    test("renders home component", () => {
        render(
        <MemoryRouter>   
            <Home/>
        </MemoryRouter>)
        expect(screen.getByText("API Service")).toBeInTheDocument()
        expect(screen.queryAllByText("Geocoding API")[0]).toBeInTheDocument()
        expect(screen.getByText("Weather API")).toBeInTheDocument()
    })

});


const request = require('supertest');
const app = require('./app');
const axios = require('axios');

jest.mock('axios');

describe('GET /', () => {
    test('returns 200 with "Server"', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toBe('Server');
    });
});

describe('GET /users', () => {
    test('returns 200', async () => {
        const res = await request(app).get('/users');
        expect(res.status).toBe(200);
    });
});

describe('GET /api/weather/', () => {
    test('returns weather data for valid coords', async () => {
        axios.get.mockResolvedValue({
            data: { name: 'London', main: { temp: 15 } }
        });

        const res = await request(app)
            .get('/api/weather/')
            .query({ lat: 51.5, lon: -0.1 });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('London');
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('lat=51.5')
        );
    });

    test('does not call API for invalid latitude > 90', async () => {
        axios.get.mockClear();

        await request(app)
            .get('/api/weather/')
            .query({ lat: 91, lon: 0 });

        expect(axios.get).not.toHaveBeenCalled();
    });

    test('does not call API for invalid latitude < -90', async () => {
        axios.get.mockClear();

        await request(app)
            .get('/api/weather/')
            .query({ lat: -91, lon: 0 });

        expect(axios.get).not.toHaveBeenCalled();
    });

    test('does not call API for invalid longitude > 180', async () => {
        axios.get.mockClear();

        await request(app)
            .get('/api/weather/')
            .query({ lat: 0, lon: 181 });

        expect(axios.get).not.toHaveBeenCalled();
    });

    test('does not call API for invalid longitude < -180', async () => {
        axios.get.mockClear();

        await request(app)
            .get('/api/weather/')
            .query({ lat: 0, lon: -181 });

        expect(axios.get).not.toHaveBeenCalled();
    });
});

describe('GET /api/geo/cod/', () => {
    /*
    test('returns geocoding data for valid city', async () => {
        axios.get.mockResolvedValue({
            data: [{ name: 'London', lat: 51.5, lon: -0.1 }]
        });

        const res = await request(app)
            .get('/api/geo/cod/')
            .query({ city: 'London', state_code: '', country_code: 'GB' });

        expect(res.status).toBe(200);
        expect(res.body[0].name).toBe('London');
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('city=London')
        );
    });

    
    */
    test('calls geo API with correct query params', async () => {
        axios.get.mockResolvedValue({ data: [] });

        await request(app)
            .get('/api/geo/cod/')
            .query({ city: 'Paris', state_code: '', country_code: 'FR' });

        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('Paris')
        );
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('FR')
        );
    });

    test('returns empty array when city not found', async () => {
        axios.get.mockResolvedValue({ data: [] });

        const res = await request(app)
            .get('/api/geo/cod/')
            .query({ city: 'nonexistentcity123', state_code: '', country_code: '' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});
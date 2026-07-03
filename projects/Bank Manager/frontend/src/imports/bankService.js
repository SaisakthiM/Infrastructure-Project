import axios from 'axios';

// Base API URL
const API_BASE_URL = '/bank/api';

const bankService = {
  // Create new account
  createAccount: async (customerName, accountNumber) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/accounts`, {
        customerName,
        accountNumber,
      });
      console.log(response)
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get all accounts
  getAllAccounts: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounts`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get account by ID
  getAccountById: async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounts/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Deposit money
  deposit: async (accountId, amount) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/accounts/${accountId}/deposit`, {
        amount,
      });
      console.log(response)
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Withdraw money
  withdraw: async (accountId, amount) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/accounts/${accountId}/withdraw`, {
        amount,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  takeLoan: async (accountId, amount, months) => {
      try {
          const response = await axios.post(`${API_BASE_URL}/accounts/${accountId}/loan`, {
              amount, months,
          });
          return response.data;  // ✅ was: return response
      } catch (error) {
          throw error.response?.data || error.message;
      }
  },

  repayLoan: async (accountId, amount) => {
      try {
          const response = await axios.post(`${API_BASE_URL}/accounts/${accountId}/repay`, {
              amount,
          });
          return response.data;  // ✅ was: return response
      } catch (error) {
          throw error.response?.data || error.message;
      }
  },
};



export default bankService;
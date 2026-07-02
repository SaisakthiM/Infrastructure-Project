import axios from 'axios';

const API_BASE_URL = '/bank/api';

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    username: string;
    accountNumber: string;
    accountId: string;
    balance: number;
    creditScore: number;
    loanBalance: number;
  };
}

export interface AccountResponse {
  success?: boolean;
  data: {
    customerName: string;
    accountNumber: string;
    balance: number;
    loanBalance: number;
    creditScore: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface TransactionResponse {
  success?: boolean;
  data: {
    balance: number;
    creditScore: number;
    loanBalance: number;
  };
}

const bankService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },

  register: async (username: string, password: string): Promise<AuthResponse> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register`, { username, password });
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },

  getAccountById: async (accountId: string): Promise<AccountResponse> => {
    try {
      const res = await axios.get(`${API_BASE_URL}/accounts/${accountId}`);
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },

  deposit: async (
    accountId: string,
    amount: number,
    description: string
  ): Promise<TransactionResponse> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${accountId}/deposit`, {
        amount,
        description,
      });
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },

  withdraw: async (
    accountId: string,
    amount: number,
    description: string
  ): Promise<TransactionResponse> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${accountId}/withdraw`, {
        amount,
        description,
      });
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },

  takeLoan: async (
    accountId: string,
    amount: number,
    months: number,
    description: string
  ): Promise<TransactionResponse> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${accountId}/loan`, {
        amount,
        months,
        description,
      });
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },

  repayLoan: async (
    accountId: string,
    amount: number,
    description: string
  ): Promise<TransactionResponse> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/accounts/${accountId}/repay`, {
        amount,
        description,
      });
      return res.data;
    } catch (error: any) {
      throw error.response?.data || { message: error.message };
    }
  },
};

export default bankService;

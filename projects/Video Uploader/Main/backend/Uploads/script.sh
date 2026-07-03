#!/bin/bash
# ========================================
# 🚀 Neovim Config Splitter (Preserve Original)
# ========================================
# Modularizes your config while keeping ALL features intact

set -e

CONFIG_DIR="$HOME/.config/nvim"
BACKUP_DIR="$HOME/.config/nvim_backup_$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Neovim Config Modularizer${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Backup
if [ -d "$CONFIG_DIR" ]; then
    echo -e "${YELLOW}📦 Backing up to $BACKUP_DIR${NC}"
    cp -r "$CONFIG_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✅ Backup created${NC}\n"
fi

# Create structure
echo -e "${BLUE}📁 Creating structure...${NC}"
mkdir -p "$CONFIG_DIR"/{lua/{core,plugins,config},after/ftplugin}

# ========================================
# MAIN init.lua
# ========================================
cat > "$CONFIG_DIR/init.lua" << 'EOF'
-- ========================================
-- 🚀 Saivim init.lua (Modular)
-- ========================================

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Load core
require("core.options")
require("core.keymaps")
require("core.autocmds")

-- Setup plugins
require("config.lazy")
EOF

# ========================================
# OPTIONS
# ========================================
cat > "$CONFIG_DIR/lua/core/options.lua" << 'EOF'
-- ========================================
-- ⚙️ OPTIONS
-- ========================================

local opt = vim.opt
local g = vim.g

-- Leader
g.mapleader = " "
g.maplocalleader = " "

-- Numbers
opt.number = true
opt.relativenumber = true

-- Mouse & clipboard
opt.mouse = "a"
opt.clipboard = "unnamedplus"

-- Appearance
opt.termguicolors = true
opt.signcolumn = "yes"

-- Indentation
opt.expandtab = true
opt.shiftwidth = 2
opt.tabstop = 2
opt.smartindent = true

-- Behavior
opt.wrap = false
opt.splitbelow = true
opt.splitright = true
opt.swapfile = false
opt.backup = false
opt.undofile = true
opt.updatetime = 250
opt.timeoutlen = 300

-- WSL clipboard fix
if vim.fn.has("wsl") == 1 then
  g.clipboard = {
    name = "WslClipboard",
    copy = {
      ["+"] = "clip.exe",
      ["*"] = "clip.exe",
    },
    paste = {
      ["+"] = 'powershell.exe -c [Console]::Out.Write($(Get-Clipboard -Raw).tostring().replace("`r", ""))',
      ["*"] = 'powershell.exe -c [Console]::Out.Write($(Get-Clipboard -Raw).tostring().replace("`r", ""))',
    },
    cache_enabled = 0,
  }
end

-- Linting enabled by default
g.lint_enabled = true

-- Load .gitignore into wildignore
local function load_gitignore()
  local gitignore = vim.fn.findfile(".gitignore", ".;")
  if gitignore ~= "" then
    for line in io.lines(gitignore) do
      if line ~= "" and not line:match("^#") then
        local pattern = line:gsub("^/", ""):gsub("%*", "*")
        opt.wildignore:append(pattern)
      end
    end
  end
end
load_gitignore()
EOF

# ========================================
# KEYMAPS
# ========================================
cat > "$CONFIG_DIR/lua/core/keymaps.lua" << 'EOF'
-- ========================================
-- ⌨️ KEYMAPS
-- ========================================

local map = vim.keymap.set

-- File Navigation
map("n", "<leader>F", "<cmd>Telescope find_files<CR>", { desc = "Find file" })
map("n", "<leader>R", "<cmd>Telescope oldfiles<CR>", { desc = "Recent" })
map("n", "<leader>b", "<cmd>Telescope buffers<CR>", { desc = "Buffers" })
map("n", "<leader>fg", "<cmd>Telescope live_grep<CR>", { desc = "Grep" })
map("n", "<leader>fh", "<cmd>Telescope help_tags<CR>", { desc = "Help" })

-- File Tree
map("n", "<leader>T", "<cmd>Neotree toggle<CR>", { desc = "Toggle tree" })
map("n", "T", "<cmd>Neotree toggle<CR>", { desc = "Toggle tree" })
map("n", "<leader>e", "<cmd>Neotree focus<CR>", { desc = "Focus tree" })

-- New File
map("n", "<leader>N", "<cmd>ene | startinsert<CR>", { desc = "New file" })

-- Git
map("n", "G", "<cmd>Neogit<CR>", { desc = "Git UI" })
map("n", "<leader>G", function()
  local handle = io.popen("git rev-parse --is-inside-work-tree 2>/dev/null")
  local result = handle:read("*a")
  handle:close()
  if result:match("true") then
    vim.cmd("Telescope git_status")
  else
    vim.notify("Not in a git repository", vim.log.levels.WARN)
  end
end, { desc = "Git status" })
map("n", "<leader>gg", "<cmd>Neotree git_status<CR>", { desc = "Git status tree" })

-- LSP
map("n", "gd", vim.lsp.buf.definition, { desc = "Definition" })
map("n", "gD", vim.lsp.buf.declaration, { desc = "Declaration" })
map("n", "gr", vim.lsp.buf.references, { desc = "References" })
map("n", "gi", vim.lsp.buf.implementation, { desc = "Implementation" })
map("n", "K", vim.lsp.buf.hover, { desc = "Hover" })
map("n", "<leader>rn", vim.lsp.buf.rename, { desc = "Rename" })
map("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code action" })

-- Diagnostics
map("n", "<leader>xx", "<cmd>Trouble diagnostics toggle<CR>", { desc = "Diagnostics" })
map("n", "<leader>xX", "<cmd>Trouble diagnostics toggle filter.buf=0<CR>", { desc = "Buffer diagnostics" })
map("n", "<leader>xl", "<cmd>Trouble loclist toggle<CR>", { desc = "Location list" })
map("n", "<leader>xq", "<cmd>Trouble qflist toggle<CR>", { desc = "Quickfix" })

-- Symbols
map("n", "<leader>o", "<cmd>SymbolsOutline<CR>", { desc = "Outline" })

-- AI (Avante)
map("n", "<leader>ai", "<cmd>AvanteAsk<CR>", { desc = "AI ask" })
map("v", "<leader>ai", "<cmd>AvanteAsk<CR>", { desc = "AI ask" })
map("n", "<leader>ac", "<cmd>AvanteChat<CR>", { desc = "AI chat" })
map("v", "<leader>ac", "<cmd>AvanteChat<CR>", { desc = "AI chat" })
map("n", "<leader>ae", "<cmd>AvanteEdit<CR>", { desc = "AI edit" })
map("v", "<leader>ae", "<cmd>AvanteEdit<CR>", { desc = "AI edit" })
map("n", "<leader>ar", "<cmd>AvanteRefresh<CR>", { desc = "AI refresh" })
map("n", "<leader>at", "<cmd>AvanteToggle<CR>", { desc = "AI toggle" })
map("n", "<leader>am", function()
  vim.ui.input({ prompt = "Model: ", default = "qwen2.5-coder:3b" }, function(input)
    if input then
      require("avante.config").override({ 
        providers = { ollama = { model = input } } 
      })
      vim.notify("Model: " .. input, vim.log.levels.INFO)
    end
  end)
end, { desc = "Change AI model" })

-- Session
map("n", "<leader>ss", function() require("persistence").load() end, { desc = "Restore" })
map("n", "<leader>sl", function() require("persistence").load({ last = true }) end, { desc = "Last" })
map("n", "<leader>sd", function() require("persistence").stop() end, { desc = "Don't save" })

-- Search & Replace
map("n", "<leader>S", '<cmd>lua require("spectre").toggle()<CR>', { desc = "Spectre" })
map("n", "<leader>sw", '<cmd>lua require("spectre").open_visual({select_word=true})<CR>', { desc = "Search word" })

-- Buffers
map("n", "<S-l>", "<cmd>bnext<CR>", { desc = "Next" })
map("n", "<S-h>", "<cmd>bprevious<CR>", { desc = "Previous" })
map("n", "<leader>bd", "<cmd>bdelete<CR>", { desc = "Delete" })

-- Tabs
map("n", "<S-Right>", "<cmd>tabnext<CR>", { desc = "Next tab" })
map("n", "<S-Left>", "<cmd>tabprevious<CR>", { desc = "Prev tab" })
map("n", "<C-t>", "<cmd>tab split<CR>", { desc = "New tab" })

-- Windows
map("n", "<C-Left>", "<C-w>h", { desc = "Left" })
map("n", "<C-Down>", "<C-w>j", { desc = "Down" })
map("n", "<C-Up>", "<C-w>k", { desc = "Up" })
map("n", "<C-Right>", "<C-w>l", { desc = "Right" })
map("t", "<C-Left>", "<C-\\><C-n><C-w>h")
map("t", "<C-Down>", "<C-\\><C-n><C-w>j")
map("t", "<C-Up>", "<C-\\><C-n><C-w>k")
map("t", "<C-Right>", "<C-\\><C-n><C-w>l")
map("t", "<Esc><Esc>", "<C-\\><C-n>")

-- Editing
map("n", "<C-z>", "u", { desc = "Undo" })
map("n", "<C-y>", "<C-r>", { desc = "Redo" })
map("v", "<", "<gv")
map("v", ">", ">gv")
map("n", "<A-j>", "<cmd>m .+1<CR>==")
map("n", "<A-k>", "<cmd>m .-2<CR>==")
map("v", "<A-j>", ":m '>+1<CR>gv=gv")
map("v", "<A-k>", ":m '<-2<CR>gv=gv")

-- Clipboard
map("v", "<C-c>", '"+y')
map("n", "<C-v>", '"+p')
map("i", "<C-v>", '<C-r>+')
map("v", "<C-x>", '"+d')
map("n", "<C-a>", "ggVG")

-- QOL
map("n", "<leader>w", "<cmd>w<CR>", { desc = "Save" })
map("n", "<leader>q", "<cmd>q<CR>", { desc = "Quit" })
map("n", "<leader>Q", "<cmd>qa<CR>", { desc = "Quit all" })
map("n", "<leader>x", "<cmd>wq<CR>", { desc = "Save & quit" })
map("n", "<leader>h", "<cmd>nohlsearch<CR>", { desc = "No highlight" })

-- Toggle lint
map("n", "<leader>lt", function()
  vim.g.lint_enabled = not vim.g.lint_enabled
  print("Linting " .. (vim.g.lint_enabled and "enabled" or "disabled"))
end, { desc = "Toggle lint" })
EOF

# ========================================
# AUTOCMDS
# ========================================
cat > "$CONFIG_DIR/lua/core/autocmds.lua" << 'EOF'
-- ========================================
-- 🔄 AUTOCMDS
-- ========================================

local autocmd = vim.api.nvim_create_autocmd

-- Highlight yank
autocmd("TextYankPost", {
  callback = function()
    vim.highlight.on_yank()
  end,
})

-- Auto save
autocmd({ "TextChanged", "TextChangedI", "InsertLeave" }, {
  callback = function()
    if vim.bo.modified and vim.bo.buftype == "" then
      vim.cmd("silent! write")
    end
  end,
})

-- Start in ~/Coding-Project
autocmd("VimEnter", {
  callback = function()
    if vim.fn.argc() == 0 then
      local dir = vim.fn.expand("~/Coding-Project")
      if vim.fn.isdirectory(dir) == 1 then
        pcall(vim.fn.chdir, dir)
      end
    end
  end,
})

-- Sync terminal directory
autocmd({ "BufEnter", "DirChanged" }, {
  callback = function()
    local file = vim.fn.expand("%:p")
    local dir = vim.fn.expand("%:p:h")
    
    if file ~= "" and vim.fn.isdirectory(dir) == 1 then
      local terms = vim.tbl_filter(function(buf)
        return vim.bo[buf].buftype == "terminal"
      end, vim.api.nvim_list_bufs())
      
      for _, buf in ipairs(terms) do
        local chan = vim.bo[buf].channel
        if chan then
          vim.fn.chansend(chan, string.format("cd '%s'\n", dir))
        end
      end
    end
  end,
})

-- Disable auto-comment
autocmd("BufEnter", {
  callback = function()
    vim.opt.formatoptions:remove({ "c", "r", "o" })
  end,
})

-- Auto-save session
autocmd("BufWritePre", {
  callback = function()
    require("persistence").save()
  end,
})

-- Enable colorizer
autocmd("BufEnter", {
  pattern = { "*.css", "*.scss", "*.html", "*.lua", "*.js", "*.ts", "*.jsx", "*.tsx" },
  callback = function()
    vim.cmd("ColorizerAttachToBuffer")
  end,
})

-- Lint on save/insert leave
autocmd({ "BufWritePost", "InsertLeave" }, {
  callback = function()
    if vim.g.lint_enabled then
      pcall(function()
        require("lint").try_lint()
      end)
    end
  end,
})
EOF

# ========================================
# LAZY CONFIG
# ========================================
cat > "$CONFIG_DIR/lua/config/lazy.lua" << 'EOF'
-- ========================================
-- 📦 LAZY SETUP
-- ========================================

require("lazy").setup("plugins", {
  defaults = { lazy = true },
  install = { colorscheme = { "kanagawa" } },
  checker = { enabled = true },
  performance = {
    rtp = {
      disabled_plugins = {
        "gzip", "tarPlugin", "tohtml",
        "tutor", "zipPlugin",
      },
    },
  },
})
EOF

# ========================================
# PLUGINS
# ========================================

# Theme
cat > "$CONFIG_DIR/lua/plugins/theme.lua" << 'EOF'
return {
  {
    "rebelot/kanagawa.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("kanagawa").setup({
        transparent = true,
        theme = "wave",
        overrides = function(colors)
          local theme = colors.theme
          return {
            Normal = { bg = "NONE" },
            NormalNC = { bg = "NONE" },
            NormalFloat = { bg = "NONE" },
            FloatBorder = { fg = "NONE", bg = "NONE" },
            FloatTitle = { fg = theme.syn.fun, bg = "NONE", bold = true },
            WinSeparator = { fg = "NONE", bg = "NONE" },
            VertSplit = { fg = "NONE", bg = "NONE" },
            
            -- Avante
            AvanteWinBar = { fg = theme.syn.fun, bg = "NONE" },
            AvanteWinBarNC = { fg = theme.ui.fg_dim, bg = "NONE" },
            AvanteSeparator = { fg = "NONE", bg = "NONE" },
            AvanteTitle = { fg = theme.syn.fun, bg = "NONE", bold = true },
            AvanteReversedTitle = { fg = theme.ui.bg, bg = theme.syn.fun },
            AvanteSubtitle = { fg = theme.syn.identifier, bg = "NONE" },
            AvanteReversedSubtitle = { fg = theme.ui.bg, bg = theme.syn.identifier },
            AvanteThirdTitle = { fg = theme.syn.string, bg = "NONE" },
            AvanteReversedThirdTitle = { fg = theme.ui.bg, bg = theme.syn.string },
            AvanteConflictCurrent = { bg = theme.diff.change },
            AvanteConflictIncoming = { bg = theme.diff.add },
            AvanteConflictCurrentLabel = { fg = theme.ui.bg, bg = theme.diag.warning },
            AvanteConflictIncomingLabel = { fg = theme.ui.bg, bg = theme.diag.hint },
            
            -- Popup
            Pmenu = { fg = theme.ui.fg, bg = "NONE" },
            PmenuSel = { fg = "NONE", bg = theme.ui.bg_p2 },
            PmenuSbar = { bg = theme.ui.bg_m1 },
            PmenuThumb = { bg = theme.ui.bg_p2 },
            
            -- Diff
            DiffAdd = { fg = "NONE", bg = theme.diff.add },
            DiffDelete = { fg = "NONE", bg = theme.diff.delete },
            DiffChange = { fg = "NONE", bg = theme.diff.change },
            DiffText = { fg = "NONE", bg = theme.diff.text },
          }
        end,
      })
      vim.cmd.colorscheme("kanagawa-wave")
    end,
  },
}
EOF

# UI
cat > "$CONFIG_DIR/lua/plugins/ui.lua" << 'EOF'
return {
  {
    "nvim-lualine/lualine.nvim",
    event = "VeryLazy",
    opts = { options = { theme = "kanagawa" } },
  },
  {
    "akinsho/bufferline.nvim",
    event = "VeryLazy",
    opts = {
      options = {
        diagnostics = "nvim_lsp",
        offsets = {
          {
            filetype = "neo-tree",
            text = "File Explorer",
            highlight = "Directory",
            text_align = "left",
          },
        },
      },
    },
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    event = "BufReadPost",
    main = "ibl",
    opts = {
      indent = { char = "│" },
      scope = { enabled = true },
    },
  },
  {
    "rcarriga/nvim-notify",
    event = "VeryLazy",
    config = function()
      require("notify").setup({
        background_colour = "#000000",
        render = "minimal",
      })
      vim.notify = require("notify")
    end,
  },
  {
    "folke/noice.nvim",
    event = "VeryLazy",
    dependencies = {
      "MunifTanjim/nui.nvim",
      "rcarriga/nvim-notify",
    },
    opts = {
      lsp = {
        override = {
          ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
          ["vim.lsp.util.stylize_markdown"] = true,
          ["cmp.entry.get_documentation"] = true,
        },
      },
      presets = {
        bottom_search = true,
        command_palette = true,
        long_message_to_split = true,
      },
    },
  },
  {
    "norcalli/nvim-colorizer.lua",
    event = "BufReadPost",
    config = function()
      require("colorizer").setup({ "*" }, {
        RGB = true,
        RRGGBB = true,
        names = true,
        RRGGBBAA = true,
        css = true,
        css_fn = true,
      })
    end,
  },
}
EOF

# Navigation
cat > "$CONFIG_DIR/lua/plugins/navigation.lua" << 'EOF'
return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    cmd = "Neotree",
    keys = {
      { "<leader>T", "<cmd>Neotree toggle<CR>" },
      { "T", "<cmd>Neotree toggle<CR>" },
    },
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    },
    config = function()
      require("neo-tree").setup({
        close_if_last_window = true,
        popup_border_style = "rounded",
        enable_git_status = true,
        enable_diagnostics = true,
        window = {
          position = "left",
          width = 35,
        },
        filesystem = {
          filtered_items = {
            visible = true,
            hide_dotfiles = false,
            hide_gitignored = false,
          },
          follow_current_file = { enabled = true },
          use_libuv_file_watcher = true,
        },
        default_component_configs = {
          indent = {
            indent_size = 2,
            padding = 1,
            with_markers = true,
            indent_marker = "│",
            last_indent_marker = "└",
          },
          icon = {
            folder_closed = "",
            folder_open = "",
            folder_empty = "",
            default = "",
          },
          git_status = {
            symbols = {
              added = "✚",
              modified = "",
              deleted = "✖",
              renamed = "󰁕",
              untracked = "",
              ignored = "",
              unstaged = "󰄱",
              staged = "",
              conflict = "",
            },
          },
        },
      })
      
      -- Kanagawa transparent theme
      vim.api.nvim_create_autocmd({"VimEnter", "ColorScheme"}, {
        callback = function()
          vim.api.nvim_set_hl(0, "NeoTreeNormal", { bg = "NONE", fg = "#c5c9c5" })
          vim.api.nvim_set_hl(0, "NeoTreeNormalNC", { bg = "NONE", fg = "#c5c9c5" })
          vim.api.nvim_set_hl(0, "NeoTreeEndOfBuffer", { bg = "NONE" })
          vim.api.nvim_set_hl(0, "NeoTreeBorder", { bg = "NONE", fg = "#625e5a" })
          vim.api.nvim_set_hl(0, "NeoTreeWinSeparator", { bg = "NONE", fg = "#625e5a" })
          vim.api.nvim_set_hl(0, "NeoTreeDirectoryName", { fg = "#8ba4b0" })
          vim.api.nvim_set_hl(0, "NeoTreeDirectoryIcon", { fg = "#c4b28a" })
          vim.api.nvim_set_hl(0, "NeoTreeRootName", { fg = "#c4746e", bold = true })
          vim.api.nvim_set_hl(0, "NeoTreeFileName", { fg = "#c5c9c5" })
          vim.api.nvim_set_hl(0, "NeoTreeFileIcon", { fg = "#a292a3" })
          vim.api.nvim_set_hl(0, "NeoTreeFileNameOpened", { fg = "#8a9a7b", bold = true })
          vim.api.nvim_set_hl(0, "NeoTreeGitAdded", { fg = "#8a9a7b" })
          vim.api.nvim_set_hl(0, "NeoTreeGitDeleted", { fg = "#c4746e" })
          vim.api.nvim_set_hl(0, "NeoTreeGitModified", { fg = "#c4b28a" })
          vim.api.nvim_set_hl(0, "NeoTreeGitConflict", { fg = "#E46876" })
          vim.api.nvim_set_hl(0, "NeoTreeGitUntracked", { fg = "#8ea4a2" })
          vim.api.nvim_set_hl(0, "NeoTreeGitIgnored", { fg = "#a6a69c" })
          vim.api.nvim_set_hl(0, "NeoTreeIndentMarker", { fg = "#625e5a" })
          vim.api.nvim_set_hl(0, "NeoTreeModified", { fg = "#c4b28a" })
        end,
      })
    end,
  },
  {
    "nvim-telescope/telescope.nvim",
    cmd = "Telescope",
    keys = {
      { "<leader>F", "<cmd>Telescope find_files<CR>" },
      { "<leader>R", "<cmd>Telescope oldfiles<CR>" },
      { "<leader>b", "<cmd>Telescope buffers<CR>" },
      { "<leader>fg", "<cmd>Telescope live_grep<CR>" },
    },
    dependencies = { "nvim-lua/plenary.nvim" },
    opts = {
      defaults = {
        file_ignore_patterns = { "node_modules", ".git/" },
        vimgrep_arguments = {
          "rg", "--color=never", "--no-heading",
          "--with-filename", "--line-number", "--column",
          "--smart-case", "--hidden",
        },
      },
      pickers = {
        find_files = {
          hidden = true,
          find_command = { "rg", "--files", "--hidden", "--glob", "!.git/*" },
        },
      },
    },
  },
  {
    "simrat39/symbols-outline.nvim",
    cmd = "SymbolsOutline",
    keys = { { "<leader>o", "<cmd>SymbolsOutline<CR>" } },
    opts = {
      width = 25,
      autofold_depth = 1,
    },
  },
  {
    "goolord/alpha-nvim",
    lazy = false,
    config = function()
      local alpha = require("alpha")
      local dashboard = require("alpha.themes.dashboard")
      
      dashboard.section.header.val = {
        "███████╗ █████╗ ██╗██╗   ██╗██╗███╗   ███╗",
        "██╔════╝██╔══██╗██║██║   ██║██║████╗ ████║",
        "███████╗███████║██║██║   ██║██║██╔████╔██║",
        "╚════██║██╔══██║██║╚██╗ ██╔╝██║██║╚██╔╝██║",
        "███████║██║  ██║██║ ╚████╔╝ ██║██║ ╚═╝ ██║",
        "╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═╝╚═╝     ╚═╝",
        "           ⚡ Saivim — Kanagawa Edition",
      }
      
      dashboard.section.buttons.val = {
        dashboard.button("F", "📁 Find file", ":Telescope find_files cwd=~/Coding-Project<CR>"),
        dashboard.button("R", "🕘 Recent", ":Telescope oldfiles<CR>"),
        dashboard.button("G", "🌲 Git", ":Neogit<CR>"),
        dashboard.button("T", "🗂️  Tree", ":Neotree toggle<CR>"),
        dashboard.button("N", "📝 New", ":ene | startinsert<CR>"),
        dashboard.button("S", "💾 Session", ":lua require('persistence').load()<CR>"),
        dashboard.button("A", "🤖 AI", ":AvanteToggle<CR>"),
        dashboard.button("c", "⚙️  Config", ":e ~/.config/nvim/init.lua<CR>"),
        dashboard.button("q", "❌ Quit", ":qa<CR>"),
      }
      
      dashboard.section.footer.val = "Happy coding, Sai! 🚀"
      alpha.setup(dashboard.opts)
    end,
  },
}
EOF

# LSP
cat > "$CONFIG_DIR/lua/plugins/lsp.lua" << 'EOF'
return {
  {
    "williamboman/mason.nvim",
    cmd = "Mason",
    build = ":MasonUpdate",
    config = true,
  },
  {
    "williamboman/mason-lspconfig.nvim",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = { "mason.nvim" },
    opts = {
      ensure_installed = {
        "lua_ls", "ts_ls", "pyright", "rust_analyzer",
        "gopls", "clangd", "html", "cssls", "jsonls",
        "yamlls", "dockerls", "bashls", "marksman",
        "jdtls", "intelephense", "kotlin_language_server",
        "omnisharp", "sqlls", "graphql", "taplo", "vimls", "cmake",
      },
      automatic_installation = true,
    },
  },
  {
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    dependencies = { "mason.nvim" },
    opts = {
      ensure_installed = {
        "eslint_d", "stylelint", "markdownlint",
        "yamllint", "jsonlint", "hadolint",
        "golangci-lint", "phpcs", "checkstyle", "sqlfluff",
      },
      auto_update = true,
      run_on_start = true,
    },
  },
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = { "mason-lspconfig.nvim", "hrsh7th/cmp-nvim-lsp" },
    config = function()
      local capabilities = require("cmp_nvim_lsp").default_capabilities()
      
      -- Configure servers
      vim.lsp.config("lua_ls", {
        capabilities = capabilities,
        settings = { 
          Lua = { 
            diagnostics = { globals = { "vim" } },
            workspace = { checkThirdParty = false },
          } 
        },
      })
      
      vim.lsp.config("vtsls", {
        capabilities = capabilities,
        filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
      })
      
      vim.lsp.config("pyright", {
        capabilities = capabilities,
        settings = {
          python = {
            analysis = {
              typeCheckingMode = "basic",
              autoSearchPaths = true,
              useLibraryCodeForTypes = true,
            },
          },
        },
      })
      
      vim.lsp.config("rust_analyzer", { capabilities = capabilities })
      vim.lsp.config("gopls", { capabilities = capabilities })
      vim.lsp.config("clangd", { capabilities = capabilities })
      vim.lsp.config("jdtls", {
        capabilities = capabilities,
        root_dir = vim.fs.root(0, { "gradlew", "mvnw", ".git" }),
      })
      vim.lsp.config("intelephense", { capabilities = capabilities })
      vim.lsp.config("kotlin_language_server", { capabilities = capabilities })
      vim.lsp.config("omnisharp", { capabilities = capabilities })
      vim.lsp.config("html", {
        capabilities = capabilities,
        filetypes = { "html", "javascriptreact", "typescriptreact" },
      })
      vim.lsp.config("cssls", {
        capabilities = capabilities,
        filetypes = { "css", "scss", "less", "javascriptreact", "typescriptreact" },
      })
      vim.lsp.config("tailwindcss", {
        capabilities = capabilities,
        filetypes = {
          "html", "css", "javascript", "typescript",
          "javascriptreact", "typescriptreact", "vue", "svelte"
        },
        root_dir = vim.fs.root(0, {
          "tailwind.config.js", "tailwind.config.ts",
          "postcss.config.js", "package.json", ".git",
        }),
      })
      vim.lsp.config("jsonls", { capabilities = capabilities })
      vim.lsp.config("yamlls", { capabilities = capabilities })
      vim.lsp.config("dockerls", { capabilities = capabilities })
      vim.lsp.config("bashls", { capabilities = capabilities })
      vim.lsp.config("marksman", { capabilities = capabilities })
      vim.lsp.config("sqlls", { capabilities = capabilities })
      vim.lsp.config("graphql", { capabilities = capabilities })
      vim.lsp.config("taplo", { capabilities = capabilities })
      vim.lsp.config("vimls", { capabilities = capabilities })
      vim.lsp.config("cmake", { capabilities = capabilities })
      
      -- Enable all
      vim.lsp.enable({
        "lua_ls", "vtsls", "pyright", "rust_analyzer", "gopls",
        "clangd", "jdtls", "intelephense", "kotlin_language_server",
        "omnisharp", "html", "cssls", "tailwindcss", "jsonls",
        "yamlls", "dockerls", "bashls", "marksman", "sqlls",
        "graphql", "taplo", "vimls", "cmake"
      })
    end,
  },
  {
    "mfussenegger/nvim-lint",
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      local lint = require("lint")
      lint.linters_by_ft = {
        javascript = { "eslint_d" },
        typescript = { "eslint_d" },
        javascriptreact = { "eslint_d" },
        typescriptreact = { "eslint_d" },
        vue = { "eslint_d" },
        svelte = { "eslint_d" },
        python = { "ruff" },
        css = { "stylelint" },
        scss = { "stylelint" },
        less = { "stylelint" },
        markdown = { "markdownlint" },
        yaml = { "yamllint" },
        json = { "jsonlint" },
        dockerfile = { "hadolint" },
        sh = { "shellcheck" },
        c = { "clangtidy" },
        cpp = { "clangtidy" },
        go = { "golangci_lint" },
        rust = { "clippy" },
        php = { "phpcs" },
        java = { "checkstyle" },
        sql = { "sqlfluff" },
      }
    end,
  },
  {
    "nvim-treesitter/nvim-treesitter",
    event = { "BufReadPost", "BufNewFile" },
    build = ":TSUpdate",
    config = function()
      require("nvim-treesitter.configs").setup({
        ensure_installed = {
          "c", "cpp", "lua", "vim", "vimdoc",
          "javascript", "typescript", "tsx",
          "python", "rust", "go",
          "html", "css", "json", "yaml",
          "bash", "markdown"
        },
        highlight = { enable = true },
        indent = { enable = true },
      })
    end,
  },
  {
    "windwp/nvim-ts-autotag",
    event = "InsertEnter",
    dependencies = { "nvim-treesitter" },
    config = true,
  },
}
EOF

# Completion
cat > "$CONFIG_DIR/lua/plugins/completion.lua" << 'EOF'
return {
  {
    "hrsh7th/nvim-cmp",
    event = "InsertEnter",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-cmdline",
      "L3MON4D3/LuaSnip",
      "saadparwaiz1/cmp_luasnip",
      "rafamadriz/friendly-snippets",
    },
    config = function()
      local cmp = require("cmp")
      local luasnip = require("luasnip")
      
      require("luasnip.loaders.from_vscode").lazy_load()
      
      cmp.setup({
        snippet = {
          expand = function(args)
            luasnip.lsp_expand(args.body)
          end,
        },
        window = {
          completion = cmp.config.window.bordered(),
          documentation = cmp.config.window.bordered(),
        },
        mapping = cmp.mapping.preset.insert({
          ["<C-b>"] = cmp.mapping.scroll_docs(-4),
          ["<C-f>"] = cmp.mapping.scroll_docs(4),
          ["<C-Space>"] = cmp.mapping.complete(),
          ["<C-e>"] = cmp.mapping.abort(),
          ["<CR>"] = cmp.mapping.confirm({ select = true }),
          ["<Tab>"] = cmp.mapping(function(fallback)
            if cmp.visible() then
              cmp.select_next_item()
            elseif luasnip.expand_or_jumpable() then
              luasnip.expand_or_jump()
            else
              fallback()
            end
          end, { "i", "s" }),
          ["<S-Tab>"] = cmp.mapping(function(fallback)
            if cmp.visible() then
              cmp.select_prev_item()
            elseif luasnip.jumpable(-1) then
              luasnip.jump(-1)
            else
              fallback()
            end
          end, { "i", "s" }),
        }),
        sources = {
          { name = "nvim_lsp" },
          { name = "luasnip" },
          { name = "buffer" },
          { name = "path" },
        },
      })
    end,
  },
  {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    config = function()
      local npairs = require("nvim-autopairs")
      npairs.setup({
        check_ts = true,
        ts_config = {
          lua = { "string" },
          javascript = { "template_string" },
        },
      })
      
      local cmp_autopairs = require("nvim-autopairs.completion.cmp")
      require("cmp").event:on("confirm_done", cmp_autopairs.on_confirm_done())
    end,
  },
}
EOF

# Git
cat > "$CONFIG_DIR/lua/plugins/git.lua" << 'EOF'
return {
  {
    "lewis6991/gitsigns.nvim",
    event = { "BufReadPre", "BufNewFile" },
    opts = {
      current_line_blame = true,
      current_line_blame_opts = {
        virt_text = true,
        virt_text_pos = "eol",
        delay = 300,
      },
    },
  },
  {
    "TimUntersberger/neogit",
    cmd = "Neogit",
    keys = { { "G", "<cmd>Neogit<CR>" } },
    dependencies = { "nvim-lua/plenary.nvim" },
    config = true,
  },
  { "tpope/vim-fugitive", cmd = "Git" },
}
EOF

# AI
cat > "$CONFIG_DIR/lua/plugins/ai.lua" << 'EOF'
return {
  {
    "yetone/avante.nvim",
    event = "VeryLazy",
    lazy = false,
    version = false,
    opts = {
      provider = "ollama",
      providers = {
        ollama = {
          endpoint = "http://127.0.0.1:11434",
          model = "qwen2.5-coder:3b",
          timeout = 30000,
          temperature = 0,
          max_tokens = 4096,
        },
      },
      behaviour = {
        auto_suggestions = false,
        auto_set_highlight_group = true,
        auto_set_keymaps = true,
        auto_apply_diff_after_generation = false,
        support_paste_from_clipboard = true,
      },
      mappings = {
        ask = "<leader>aa",
        edit = "<leader>ae",
        refresh = "<leader>ar",
        submit = { normal = "<CR>", insert = "<C-s>" },
      },
      hints = { enabled = true },
      windows = {
        position = "right",
        wrap = true,
        width = 35,
        sidebar_header = {
          align = "center",
          rounded = false,
        },
      },
      highlights = {
        diff = {
          current = "DiffText",
          incoming = "DiffAdd",
        },
        sidebar = {
          background = "NormalFloat",
          header = "Title",
        },
      },
      diff = { autojump = true, list_opener = "copen" },
    },
    build = "make",
    dependencies = {
      "nvim-treesitter/nvim-treesitter",
      "stevearc/dressing.nvim",
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      "nvim-tree/nvim-web-devicons",
      {
        "HakonHarnes/img-clip.nvim",
        event = "VeryLazy",
        opts = {
          default = {
            embed_image_as_base64 = false,
            prompt_for_file_name = false,
          },
        },
      },
      {
        "MeanderingProgrammer/render-markdown.nvim",
        opts = { file_types = { "markdown", "Avante" } },
        ft = { "markdown", "Avante" },
      },
    },
  },
}
EOF

# Utilities
cat > "$CONFIG_DIR/lua/plugins/utilities.lua" << 'EOF'
return {
  { "folke/which-key.nvim", event = "VeryLazy", config = true },
  { "numToStr/Comment.nvim", keys = { "gc", "gb" }, config = true },
  { "kylechui/nvim-surround", event = "InsertEnter", config = true },
  { "mg979/vim-visual-multi", branch = "master", keys = { "<C-n>", "<C-Down>", "<C-Up>" } },
  {
    "folke/trouble.nvim",
    cmd = "Trouble",
    keys = { { "<leader>xx", "<cmd>Trouble diagnostics toggle<CR>" } },
    config = true,
  },
  {
    "folke/persistence.nvim",
    event = "BufReadPre",
    opts = {
      dir = vim.fn.expand(vim.fn.stdpath("state") .. "/sessions/"),
      options = { "buffers", "curdir", "tabpages", "winsize" },
    },
  },
  {
    "nvim-pack/nvim-spectre",
    cmd = "Spectre",
    keys = { { "<leader>S", '<cmd>lua require("spectre").toggle()<CR>' } },
    dependencies = { "nvim-lua/plenary.nvim" },
    config = true,
  },
  {
    "akinsho/toggleterm.nvim",
    keys = { { "<F12>", "<cmd>ToggleTerm<CR>", mode = { "n", "t" } } },
    opts = {
      direction = "horizontal",
      size = 15,
      shell = "fish",
    },
  },
}
EOF

echo -e "${GREEN}✅ All plugin files created${NC}"

# ========================================
# COMPLETION
# ========================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✨ Modularization complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}📁 Structure:${NC}"
echo -e "  ~/.config/nvim/"
echo -e "  ├── init.lua"
echo -e "  └── lua/"
echo -e "      ├── core/"
echo -e "      │   ├── options.lua"
echo -e "      │   ├── keymaps.lua"
echo -e "      │   └── autocmds.lua"
echo -e "      ├── config/"
echo -e "      │   └── lazy.lua"
echo -e "      └── plugins/"
echo -e "          ├── theme.lua        (Kanagawa)"
echo -e "          ├── ui.lua           (Noice, Notify, Colorizer)"
echo -e "          ├── navigation.lua   (Neo-tree, Telescope, Alpha)"
echo -e "          ├── lsp.lua          (Mason, LSP, Treesitter)"
echo -e "          ├── completion.lua   (nvim-cmp)"
echo -e "          ├── git.lua          (Gitsigns, Neogit)"
echo -e "          ├── ai.lua           (Avante/Ollama)"
echo -e "          └── utilities.lua    (Misc plugins)"

echo -e "\n${GREEN}✅ Preserved features:${NC}"
echo -e "  • Kanagawa theme (transparent, wave variant)"
echo -e "  • Neo-tree with Kanagawa colors"
echo -e "  • Avante AI (qwen2.5-coder:3b)"
echo -e "  • Noice.nvim (cmdline popup)"
echo -e "  • All LSP servers"
echo -e "  • Git integration"
echo -e "  • Alpha dashboard"
echo -e "  • Auto-save, auto-cd"
echo -e "  • Terminal sync"

echo -e "\n${YELLOW}🔧 Next steps:${NC}"
echo -e "  1. ${BLUE}nvim${NC} - Start Neovim"
echo -e "  2. Plugins will auto-install"
echo -e "  3. Wait for Mason to install LSP servers"

echo -e "\n${YELLOW}💡 The question marks:${NC}"
echo -e "  Install a Nerd Font to see proper icons:"
echo -e "  ${BLUE}https://www.nerdfonts.com/${NC}"

echo -e "\n${YELLOW}💾 Backup:${NC}"
echo -e "  ${BLUE}$BACKUP_DIR${NC}"

echo -e "\n${GREEN}🎉 Done! Everything preserved, now modular!${NC}\n"
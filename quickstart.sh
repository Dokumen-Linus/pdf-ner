#!/usr/bin/env bash

set -uo pipefail

# =============================================================================
# Ubuntu Development Environment Setup
#
# Installs:
# - CPython 3.13 via pyenv (NOT conda)
# - C and C++ toolchains
# - AWS CLI v2
# - PostgreSQL (including pg_ctl + psql)
# - dbmate
# - VS Code
# - Node.js + npm
# - Bun
# - Redis
# - Docker + Compose plugin
# - GitHub CLI
# - cloudflared
# - runpodctl
# - Stripe CLI
# - Go
# - Rust
# - scc
# - actionlint
# - OpenSSH (optional)
# - Tesseract OCR
# - Google Chrome
# - Codex CLI
# - OpenCode CLI
# - Global npm packages (ESLint, Prettier, Playwright, ...)
# - Global pip packages (pytest, ruff, pyright, deptry, ...)
#
# Tested on Ubuntu 24.04+
# =============================================================================

FAILED_STEPS=()

log_section() {
    echo
    echo "========================================="
    echo "$1"
    echo "========================================="
}

record_failure() {
    FAILED_STEPS+=("$1")
    echo "ERROR: $1 failed; continuing with remaining steps." >&2
}

run_step() {
    local name="$1"
    shift

    log_section "$name"
    if "$@"; then
        echo "OK: $name"
    else
        record_failure "$name"
    fi
}

run_optional_step() {
    local name="$1"
    shift

    log_section "$name"
    if "$@"; then
        echo "OK: $name"
    else
        echo "WARN: $name failed; continuing." >&2
    fi
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

install_ubuntu_packages() {
    sudo apt update || return
    sudo apt upgrade -y || return

    sudo apt install -y \
        apt-transport-https \
        build-essential \
        ca-certificates \
        clang \
        clang-format \
        cmake \
        curl \
        g++ \
        gcc \
        gdb \
        git \
        gnupg \
        libbz2-dev \
        libc++-dev \
        libc++abi-dev \
        libc-dev \
        libedit-dev \
        libffi-dev \
        libgdbm-dev \
        liblzma-dev \
        libncursesw5-dev \
        libnss3-dev \
        libpq-dev \
        libreadline-dev \
        libsqlite3-dev \
        libssl-dev \
        libxml2-dev \
        libxmlsec1-dev \
        lsb-release \
        make \
        ninja-build \
        openssh-client \
        openssh-server \
        pkg-config \
        postgresql \
        postgresql-contrib \
        redis-server \
        software-properties-common \
        tesseract-ocr \
        tk-dev \
        unzip \
        uuid-dev \
        wget \
        xz-utils \
        zip \
        zlib1g-dev || return
}

install_pyenv() {
    if [ -d "$HOME/.pyenv" ] && command_exists pyenv; then
        echo "pyenv already installed"
        return 0
    fi

    if [ ! -d "$HOME/.pyenv" ]; then
        curl https://pyenv.run | bash || return
    fi

    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"

    eval "$(pyenv init - bash)" || return

    if ! grep -q 'PYENV_ROOT' "$HOME/.bashrc"; then
        cat <<'EOF' >> "$HOME/.bashrc"

# pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init - bash)"
EOF
    fi
}

install_python() {
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init - bash)" || return

    local latest_python
    latest_python="$(pyenv install --list | grep -E '^\s*3\.13\.[0-9]+$' | tail -1 | xargs)" || return

    if [ -z "$latest_python" ]; then
        echo "Unable to find a CPython 3.13 release in pyenv install list." >&2
        return 1
    fi

    pyenv install -s "$latest_python" || return
    pyenv global "$latest_python" || return

    hash -r

    python --version || return
    pip --version || return
}

install_python_packages() {
    pip install --upgrade pip || return
    pip install \
        deptry \
        jq \
        pyright \
        pytest \
        ruff \
        uv || return
}

install_aws_cli() {
    if command_exists aws; then
        echo "AWS CLI already installed at $(command -v aws)"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
            -o "awscliv2.zip" || exit
        unzip -o awscliv2.zip || exit
        sudo ./aws/install --update || exit
    ) || return

    rm -rf "$tmp_dir"
    aws --version || return
}

configure_postgresql() {
    local pg_ctl_path
    pg_ctl_path="$(find /usr/lib/postgresql -name pg_ctl | head -n 1)" || return

    if [ -n "$pg_ctl_path" ]; then
        sudo ln -sf "$pg_ctl_path" /usr/local/bin/pg_ctl || return
    fi

    sudo systemctl enable postgresql || return
    sudo systemctl start postgresql || return

    psql --version || return
    pg_ctl --version || return
}

configure_redis() {
    sudo systemctl enable redis-server || return
    sudo systemctl start redis-server || return

    redis-server --version || return
    redis-cli ping || return
}

install_nodejs() {
    if command_exists node; then
        echo "Node.js already installed at $(command -v node)"
        return 0
    fi

    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - || return
    sudo apt update || return
    sudo apt install -y nodejs || return

    node --version || return
    npm --version || return
}

install_global_npm_packages() {
    sudo npm install -g \
        @openai/codex \
        @playwright/test \
        @tanstack/cli \
        @tanstack/eslint-plugin-start \
        @typescript-eslint/eslint-plugin \
        @typescript-eslint/parser \
        better-auth \
        codesight \
        cross-env \
        depcheck \
        drizzle-kit \
        eslint \
        eslint-config-prettier \
        eslint-import-resolver-typescript \
        eslint-plugin-import \
        eslint-plugin-react \
        eslint-plugin-react-hooks \
        opencode-ai \
        patch-package \
        prettier \
        prettier-plugin-tailwindcss || return

    codex --version || return
    opencode --version || return
}

install_playwright_browsers() {
    npx playwright install --with-deps || return
}

install_bun() {
    if command_exists bun; then
        echo "Bun already installed at $(command -v bun)"
        return 0
    fi

    curl -fsSL https://bun.sh/install | bash || return

    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if ! grep -q 'BUN_INSTALL' "$HOME/.bashrc"; then
        cat <<'EOF' >> "$HOME/.bashrc"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
EOF
    fi

    bun --version || return
}

install_dbmate() {
    if command_exists dbmate; then
        echo "dbmate already installed at $(command -v dbmate)"
        return 0
    fi

    sudo curl -fsSL \
        -o /usr/local/bin/dbmate \
        https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64 || return
    sudo chmod +x /usr/local/bin/dbmate || return

    dbmate --version || return
}

install_vscode() {
    if command_exists code; then
        echo "VS Code already installed at $(command -v code)"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg || exit
        sudo install -D -o root -g root -m 644 \
            packages.microsoft.gpg \
            /etc/apt/keyrings/packages.microsoft.gpg || exit
    ) || return

    rm -rf "$tmp_dir"

    echo \
"deb [arch=amd64 signed-by=/etc/apt/keyrings/packages.microsoft.gpg] \
https://packages.microsoft.com/repos/code stable main" \
    | sudo tee /etc/apt/sources.list.d/vscode.list > /dev/null || return

    sudo apt update || return
    sudo apt install -y code || return

    code --version || return
}

configure_openssh() {
    sudo systemctl enable ssh || return
    sudo systemctl start ssh || return

    ssh -V || return
    ssh-keygen -h >/dev/null 2>&1 || true
    scp -V || true
}

verify_cpp_toolchain() {
    gcc --version || return
    g++ --version || return
    clang --version || return
    cmake --version || return
    ninja --version || return
    gdb --version || return
    make --version || return
}

install_docker() {
    if command_exists docker; then
        echo "Docker already installed at $(command -v docker)"
        return 0
    fi

    sudo install -m 0755 -d /etc/apt/keyrings || return

    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg || return

    sudo chmod a+r /etc/apt/keyrings/docker.gpg || return

    echo \
      "deb [arch=$(dpkg --print-architecture) \
      signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null || return

    sudo apt update || return
    sudo apt install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin || return

    sudo systemctl enable docker || return
    sudo systemctl start docker || return
    sudo usermod -aG docker "$USER" || return

    docker --version || return
    docker compose version || return
}

install_github_cli() {
    if command_exists gh; then
        echo "GitHub CLI already installed at $(command -v gh)"
        return 0
    fi

    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg || return

    sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg || return

    echo \
"deb [arch=$(dpkg --print-architecture) \
signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null || return

    sudo apt update || return
    sudo apt install -y gh || return

    gh --version || return
}

install_cloudflared() {
    if command_exists cloudflared; then
        echo "cloudflared already installed at $(command -v cloudflared)"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
            -O cloudflared.deb || exit
        sudo dpkg -i cloudflared.deb || sudo apt-get install -f -y || exit
    ) || return

    rm -rf "$tmp_dir"
    cloudflared --version || return
}

install_runpodctl() {
    if command_exists runpodctl; then
        echo "runpodctl already installed at $(command -v runpodctl)"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        wget https://github.com/runpod/runpodctl/releases/latest/download/runpodctl-linux-amd64 \
            -O runpodctl || exit
        chmod +x runpodctl || exit
        sudo mv runpodctl /usr/local/bin/runpodctl || exit
    ) || return

    rm -rf "$tmp_dir"
    runpodctl version || return
}

install_stripe_cli() {
    if command_exists stripe; then
        echo "Stripe CLI already installed at $(command -v stripe)"
        return 0
    fi

    curl -fsSL https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public \
    | sudo gpg --dearmor -o /usr/share/keyrings/stripe.gpg || return

    echo \
"deb [signed-by=/usr/share/keyrings/stripe.gpg] \
https://packages.stripe.dev/stripe-cli-deb stable main" \
    | sudo tee /etc/apt/sources.list.d/stripe.list > /dev/null || return

    sudo apt update || return
    sudo apt install -y stripe || return

    stripe version || return
}

verify_tesseract() {
    tesseract --version || return
}

install_go() {
    if command_exists go; then
        echo "Go already installed at $(command -v go)"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        wget -q https://go.dev/dl/go1.22.0.linux-amd64.tar.gz -O go.tar.gz || exit
        sudo rm -rf /usr/local/go
        sudo tar -C /usr/local -xzf go.tar.gz || exit
    ) || return

    rm -rf "$tmp_dir"

    export PATH="/usr/local/go/bin:$PATH"

    if ! grep -q '/usr/local/go/bin' "$HOME/.bashrc"; then
        cat <<'EOF' >> "$HOME/.bashrc"

# Go
export PATH="/usr/local/go/bin:$PATH"
EOF
    fi

    go version || return
}

install_rust() {
    if command_exists rustc; then
        echo "Rust already installed at $(command -v rustc)"
        return 0
    fi

    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y || return

    export PATH="$HOME/.cargo/bin:$PATH"

    if ! grep -q '.cargo/bin' "$HOME/.bashrc"; then
        cat <<'EOF' >> "$HOME/.bashrc"

# Rust
export PATH="$HOME/.cargo/bin:$PATH"
EOF
    fi

    rustc --version || return
}

install_scc() {
    if command_exists scc; then
        echo "scc already installed at $(command -v scc)"
        return 0
    fi

    go install github.com/boyter/scc@latest || return

    export PATH="$HOME/go/bin:$PATH"
    if ! grep -q '/go/bin' "$HOME/.bashrc"; then
        cat <<'EOF' >> "$HOME/.bashrc"

# Go binaries
export PATH="$HOME/go/bin:$PATH"
EOF
    fi

    scc --version || return
}

install_actionlint() {
    if command_exists actionlint; then
        echo "actionlint already installed at $(command -v actionlint)"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        wget https://github.com/rhysd/actionlint/releases/latest/download/actionlint-linux-amd64.tar.gz \
            -O actionlint.tar.gz || exit
        tar -xzf actionlint.tar.gz || exit
        sudo mv actionlint /usr/local/bin/actionlint || exit
    ) || return

    rm -rf "$tmp_dir"
    actionlint --version || return
}

install_google_chrome() {
    if command_exists google-chrome-stable; then
        echo "Google Chrome already installed"
        return 0
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"

    (
        cd "$tmp_dir" || exit
        wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
            -O google-chrome-stable_current_amd64.deb || exit
        sudo apt install -y ./google-chrome-stable_current_amd64.deb || exit
    ) || return

    rm -rf "$tmp_dir"
    google-chrome-stable --version || return
}

print_executable_checks() {
    local executable

    log_section "Executable Checks"

    for executable in \
        python \
        pip \
        uv \
        pytest \
        ruff \
        pyright \
        deptry \
        jq \
        depcheck \
        codesight \
        aws \
        psql \
        pg_ctl \
        redis-server \
        redis-cli \
        node \
        npm \
        npx \
        bun \
        bunx \
        dbmate \
        code \
        git \
        ssh \
        ssh-keygen \
        scp \
        gcc \
        g++ \
        clang \
        clang-format \
        cmake \
        ninja \
        gdb \
        make \
        tesseract \
        docker \
        gh \
        cloudflared \
        runpodctl \
        stripe \
        codex \
        opencode \
        go \
        rustc \
        scc \
        actionlint; do
        if command_exists "$executable"; then
            printf "%-14s %s\n" "$executable:" "$(command -v "$executable")"
        else
            printf "%-14s MISSING\n" "$executable:"
        fi
    done
}

print_versions() {
    log_section "Versions"

    python --version || true
    pip --version || true
    uv --version || true
    pytest --version || true
    ruff --version || true
    pyright --version || true
    deptry --version || true
    depcheck --version || true
    codesight --version || true
    aws --version || true
    psql --version || true
    pg_ctl --version || true
    redis-server --version || true
    redis-cli --version || true
    node --version || true
    npm --version || true
    bun --version || true
    dbmate --version || true
    code --version || true
    git --version || true
    gcc --version || true
    g++ --version || true
    clang --version || true
    cmake --version || true
    ninja --version || true
    gdb --version || true
    tesseract --version || true
    docker --version || true
    docker compose version || true
    gh --version || true
    cloudflared --version || true
    runpodctl version || true
    stripe version || true
    codex --version || true
    opencode --version || true
    go version || true
    rustc --version || true
    scc --version || true
    actionlint --version || true
}

run_step "Updating system and installing Ubuntu packages" install_ubuntu_packages
run_step "Installing pyenv" install_pyenv
run_step "Installing CPython 3.13" install_python
run_step "Installing global Python packages" install_python_packages
run_step "Installing AWS CLI v2" install_aws_cli
run_step "Configuring PostgreSQL" configure_postgresql
run_step "Configuring Redis" configure_redis
run_step "Installing Node.js" install_nodejs
run_step "Installing global npm packages" install_global_npm_packages
run_step "Installing Playwright browsers and OS dependencies" install_playwright_browsers
run_step "Installing Bun" install_bun
run_step "Installing dbmate" install_dbmate
run_step "Installing VS Code" install_vscode
run_optional_step "Configuring OpenSSH" configure_openssh
run_step "Verifying C and C++ toolchains" verify_cpp_toolchain
run_step "Installing Docker" install_docker
run_step "Installing GitHub CLI" install_github_cli
run_step "Installing Go" install_go
run_step "Installing Rust" install_rust
run_step "Installing scc" install_scc
run_step "Installing actionlint" install_actionlint
run_step "Installing cloudflared" install_cloudflared
run_step "Installing runpodctl" install_runpodctl
run_step "Installing Stripe CLI" install_stripe_cli
run_step "Verifying Tesseract OCR" verify_tesseract

print_executable_checks
print_versions

run_step "Installing Google Chrome application" install_google_chrome

echo
echo "========================================="
if [ "${#FAILED_STEPS[@]}" -eq 0 ]; then
    echo "Setup complete."
else
    echo "Setup completed with failures:"
    printf " - %s\n" "${FAILED_STEPS[@]}"
fi
echo "========================================="
echo
echo "Restart terminal or run:"
echo "source ~/.bashrc"
echo
echo "Notes:"
echo "- Docker group changes require logging out and back in before docker works without sudo."
echo

if [ "${#FAILED_STEPS[@]}" -ne 0 ]; then
    exit 1
fi
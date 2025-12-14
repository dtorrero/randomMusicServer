# GitHub Setup Guide

This guide explains how to configure your GitHub repository to automatically build and publish multi-architecture Docker images.

## Prerequisites

- GitHub repository created
- Code pushed to GitHub

## Step 1: Enable GitHub Container Registry

GitHub Container Registry (ghcr.io) is automatically available for all repositories. No setup needed!

## Step 2: Configure Repository Settings

### Enable GitHub Actions

1. Go to your repository on GitHub
2. Click **Settings** → **Actions** → **General**
3. Under "Actions permissions", select **Allow all actions and reusable workflows**
4. Click **Save**

### Enable Package Permissions

1. Go to **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Check **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

## Step 3: Update docker-compose.yml

Before pushing to GitHub, update the image name in your repository:

```bash
# Edit docker-compose.yml
# Replace GITHUB_USERNAME with your actual GitHub username or organization
sed -i 's/GITHUB_USERNAME/YOUR_ACTUAL_USERNAME/g' docker-compose.yml
sed -i 's/GITHUB_USERNAME/YOUR_ACTUAL_USERNAME/g' docker-compose.prod.yml
sed -i 's/GITHUB_USERNAME/YOUR_ACTUAL_USERNAME/g' DEPLOYMENT.md
sed -i 's/GITHUB_USERNAME/YOUR_ACTUAL_USERNAME/g' README.md
```

Or manually edit these files and replace `GITHUB_USERNAME` with your username.

## Step 4: Push to GitHub

```bash
git add .
git commit -m "Add GitHub Actions workflow for Docker builds"
git push origin main
```

## Step 5: Verify Workflow Execution

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You should see the "Build and Push Docker Images" workflow running
4. Click on the workflow run to see progress
5. Wait for all jobs to complete (usually 5-10 minutes)

## Step 6: Verify Published Image

Once the workflow completes:

1. Go to your repository main page
2. Look for **Packages** in the right sidebar
3. Click on `randommusicserver`
4. You should see your published image with tags like `latest`, `main`

## Step 7: Make Image Public (Optional)

By default, packages are private. To make them public:

1. Go to the package page (from step 6)
2. Click **Package settings** (bottom right)
3. Scroll to **Danger Zone**
4. Click **Change visibility**
5. Select **Public**
6. Confirm the change

## Using the Published Image

### Run with docker-compose

Docker Compose automatically pulls the image if not present locally:

```bash
# Public image - just run (no manual pull needed)
docker compose up -d

# Private image - authenticate first, then run
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
docker compose up -d
```

### Manual pull (optional)

You can manually pull to verify the image exists:

```bash
# Public image
docker pull ghcr.io/YOUR_USERNAME/randommusicserver:latest

# Private image
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
docker pull ghcr.io/YOUR_USERNAME/randommusicserver:latest
```

## Automatic Builds

Images are automatically built when:

### On Push to Branches
- Push to `main` → builds `latest` and `main` tags
- Push to `develop` → builds `develop` tag

### On Version Tags
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# This builds:
# - v1.0.0
# - 1.0
# - 1
# - latest (if on main branch)
```

### Manual Trigger
1. Go to **Actions** tab
2. Select "Build and Push Docker Images"
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow**

## Supported Architectures

The workflow builds for:
- **linux/amd64** - Standard x86_64 servers
- **linux/arm64** - ARM 64-bit (Raspberry Pi 4, Apple Silicon)
- **linux/arm/v7** - ARM 32-bit (Raspberry Pi 3)

Docker automatically pulls the correct architecture for your system.

## Troubleshooting

### Workflow Fails with Permission Error

**Error**: `Error: failed to solve: failed to push ghcr.io/...`

**Solution**: Check workflow permissions (Step 2 above)

### Image Not Found

**Error**: `Error response from daemon: manifest for ghcr.io/... not found`

**Solutions**:
1. Verify workflow completed successfully
2. Check image name matches your GitHub username
3. If private, authenticate with `docker login ghcr.io`

### Build Takes Too Long

First build takes 5-10 minutes. Subsequent builds are faster due to layer caching.

### Want to Build Only for Specific Architecture

Edit `.github/workflows/docker-publish.yml`:

```yaml
# Change this line:
platforms: linux/amd64,linux/arm64,linux/arm/v7

# To (example - only amd64 and arm64):
platforms: linux/amd64,linux/arm64
```

## Advanced: Using Personal Access Token

For private images, create a Personal Access Token (PAT):

1. Go to GitHub **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Select scopes: `read:packages`, `write:packages`
4. Click **Generate token**
5. Copy the token

Use it to login:
```bash
echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## Next Steps

- See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions
- See [README.md](README.md) for usage documentation
- Configure your `.env` file for your music directory

## Reference

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)

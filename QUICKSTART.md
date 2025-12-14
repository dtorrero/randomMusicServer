# Quick Start Guide

Get your Random Music Server running in 5 minutes!

## For End Users (Using Pre-built Images)

### 1. Configure Your Music Directory

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set your music folder path
nano .env  # or use your preferred editor
```

Set `MUSIC_DIR_HOST` to your music folder, for example:
```
MUSIC_DIR_HOST=/run/media/sprinter/OldW/NewMus/
```

### 2. Update Docker Compose Image Name

Edit `docker-compose.yml` and replace `GITHUB_USERNAME` with the actual GitHub username where the image is published.

```yaml
image: ghcr.io/YOUR_GITHUB_USERNAME/randommusicserver:latest
```

### 3. Start the Server

Docker Compose will automatically pull the image if it's not already present:

```bash
docker compose up -d
```

### 4. Open in Browser

```
http://localhost:8000
```

That's it! 🎵

---

## For Developers (Local Development)

### 1. Setup Python Environment

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and set MUSIC_DIR to your music folder
```

### 3. Run

```bash
./run.sh
```

### 4. Open

```
http://localhost:8000
```

---

## For Repository Owners (Setting up CI/CD)

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Configure GitHub Actions

Follow [GITHUB_SETUP.md](GITHUB_SETUP.md) to:
- Enable workflow permissions
- Update image names with your username
- Verify builds complete

### 3. Users Can Now Pull Your Image

```bash
docker pull ghcr.io/YOUR_USERNAME/randommusicserver:latest
```

---

## Troubleshooting

**No music found?**
- Check `MUSIC_DIR_HOST` path in `.env`
- Ensure folder contains `.mp3` or `.flac` files

**Port 8000 in use?**
- Change port in `docker-compose.yml`: `"8080:8000"`

**Image not found?**
- Verify GitHub username in `docker-compose.yml`
- Check if image is public on GitHub

**Need help?**
- See [README.md](README.md) for full documentation
- See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment details
- See [GITHUB_SETUP.md](GITHUB_SETUP.md) for CI/CD setup

---

## What's Next?

- Click **Rescan library** in UI after adding music
- Check cover art is showing correctly
- Enjoy your random music! 🎶

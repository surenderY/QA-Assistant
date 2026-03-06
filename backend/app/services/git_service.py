"""
GitService — manages all Git operations using GitPython.

Responsibilities:
  - Clone remote repo if not present locally
  - Create feature branches (feature/{story_id}-{timestamp})
  - Write script files to the repo
  - Commit with structured message
  - Push branch to remote
  - Return branch name + commit SHA
"""

import logging
import os
import re
import time
from pathlib import Path

import git
from git import Repo, GitCommandError

from app.core.config import settings

logger = logging.getLogger(__name__)


class GitService:

    def __init__(self):
        self.repo_path = Path(settings.git_repo_path)
        self._repo: Repo | None = None

    # ── Repo access ────────────────────────────────────────────────────────

    @property
    def repo(self) -> Repo:
        if self._repo is None:
            self._repo = self._get_or_clone_repo()
        return self._repo

    def _get_or_clone_repo(self) -> Repo:
        if (self.repo_path / ".git").exists():
            logger.info(f"Opening existing repo at {self.repo_path}")
            repo = Repo(self.repo_path)
            self._configure_repo(repo)
            return repo

        if not settings.git_remote_url:
            logger.info("No remote URL — initialising local repo")
            self.repo_path.mkdir(parents=True, exist_ok=True)
            repo = Repo.init(self.repo_path)
            self._configure_repo(repo)
            # Create initial commit so branching works
            readme = self.repo_path / "README.md"
            readme.write_text("# TestGen AI — Generated Test Scripts\n")
            repo.index.add(["README.md"])
            repo.index.commit("chore: initialise test scripts repository")
            return repo

        logger.info(f"Cloning {settings.git_remote_url} → {self.repo_path}")
        self.repo_path.parent.mkdir(parents=True, exist_ok=True)
        repo = Repo.clone_from(
            self._authenticated_url(),
            self.repo_path,
        )
        self._configure_repo(repo)
        return repo

    def _configure_repo(self, repo: Repo):
        with repo.config_writer() as cfg:
            cfg.set_value("user", "name",  settings.git_author_name)
            cfg.set_value("user", "email", settings.git_author_email)

    def _authenticated_url(self) -> str:
        """Inject credentials into HTTPS remote URL."""
        url = settings.git_remote_url
        if settings.git_token and url.startswith("https://"):
            url = url.replace(
                "https://",
                f"https://{settings.git_username}:{settings.git_token}@"
            )
        return url

    # ── Branch management ──────────────────────────────────────────────────

    def create_branch(self, branch_name: str) -> str:
        """
        Create a new branch from current HEAD (usually main/master).
        Returns the branch name used (may be modified to avoid conflicts).
        """
        repo = self.repo
        safe_name = self._sanitise_branch_name(branch_name)

        # Avoid duplicate branch names
        existing = [b.name for b in repo.branches]
        if safe_name in existing:
            safe_name = f"{safe_name}-{int(time.time())}"

        # Pull latest from remote if available
        self._try_pull(repo)

        repo.create_head(safe_name)
        logger.info(f"Created branch: {safe_name}")
        return safe_name

    def checkout_branch(self, branch_name: str):
        repo = self.repo
        branch = repo.heads[branch_name]
        branch.checkout()
        logger.info(f"Checked out branch: {branch_name}")

    # ── File operations ────────────────────────────────────────────────────

    def write_file(self, relative_path: str, content: str) -> Path:
        """Write a file into the repo. Creates parent directories as needed."""
        full_path = self.repo_path / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        logger.info(f"Wrote file: {relative_path}")
        return full_path

    def stage_file(self, relative_path: str):
        self.repo.index.add([relative_path])

    # ── Commit & push ──────────────────────────────────────────────────────

    def commit(self, message: str) -> str:
        """
        Commit all staged changes.
        Returns the commit SHA.
        """
        commit_obj = self.repo.index.commit(message)
        sha = commit_obj.hexsha[:8]
        logger.info(f"Committed: {sha} — {message}")
        return commit_obj.hexsha

    def push_branch(self, branch_name: str) -> bool:
        """Push branch to remote. Returns True on success, False if no remote."""
        repo = self.repo
        if not repo.remotes:
            logger.info("No remote configured — skipping push")
            return False

        try:
            origin = repo.remote("origin")
            # Update remote URL with fresh credentials
            if settings.git_token:
                origin.set_url(self._authenticated_url())
            origin.push(refspec=f"{branch_name}:{branch_name}")
            logger.info(f"Pushed branch {branch_name} to remote")
            return True
        except GitCommandError as e:
            logger.error(f"Push failed: {e}")
            return False

    # ── High-level: commit a single script ────────────────────────────────

    def commit_script(
        self,
        script_name: str,
        script_content: str,
        story_id: str,
        branch_name: str,
        commit_message: str,
        subdir: str = "tests",
    ) -> dict:
        """
        Full flow: checkout branch → write file → stage → commit → push.

        Returns:
            dict with branch_name, commit_sha, git_path, pushed
        """
        # Checkout the branch
        self.checkout_branch(branch_name)

        # Write the file
        relative_path = f"{subdir}/{story_id.lower()}/{script_name}"
        self.write_file(relative_path, script_content)

        # Stage
        self.stage_file(relative_path)

        # Commit
        sha = self.commit(commit_message)

        # Push
        pushed = self.push_branch(branch_name)

        return {
            "branch_name": branch_name,
            "commit_sha": sha,
            "git_path": relative_path,
            "pushed": pushed,
        }

    # ── Helpers ────────────────────────────────────────────────────────────

    def _sanitise_branch_name(self, name: str) -> str:
        """Make a valid Git branch name."""
        name = re.sub(r"[^\w\-/.]", "-", name)
        name = re.sub(r"-{2,}", "-", name)
        name = name.strip("-")
        return name[:100]

    def _try_pull(self, repo: Repo):
        """Pull latest from origin if remote exists. Silently skip on failure."""
        if not repo.remotes:
            return
        try:
            repo.remotes.origin.pull()
        except Exception as e:
            logger.warning(f"Pull skipped: {e}")

    def get_branch_info(self, branch_name: str) -> dict | None:
        """Return latest commit info for a branch."""
        try:
            branch = self.repo.heads[branch_name]
            commit = branch.commit
            return {
                "branch": branch_name,
                "sha": commit.hexsha,
                "short_sha": commit.hexsha[:8],
                "message": commit.message.strip(),
                "author": str(commit.author),
                "committed_at": commit.committed_datetime.isoformat(),
            }
        except (IndexError, Exception):
            return None

    def repo_status(self) -> dict:
        """Return basic repo info."""
        repo = self.repo
        return {
            "path": str(self.repo_path),
            "current_branch": repo.active_branch.name,
            "is_dirty": repo.is_dirty(),
            "has_remote": bool(repo.remotes),
            "remote_url": repo.remotes[0].url if repo.remotes else None,
        }


# ── Singleton ──────────────────────────────────────────────────────────────
_git_service: GitService | None = None

def get_git_service() -> GitService:
    global _git_service
    if _git_service is None:
        _git_service = GitService()
    return _git_service

import asyncio
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List

import requests
from playwright.async_api import async_playwright


def get_category_from_label(label: str) -> str:
    return label.removesuffix(" Average").lower().replace(" ", "_")


def get_category_description(category: str, default: str) -> str:
    if category == "reasoning":
        return "Reasoning: a harder version of Web of Lies from Big-Bench Hard, and Zebra Puzzles"
    if category == "coding":
        return "Coding: two tasks from Leetcode and AtCoder (via LiveCodeBench): code generation and a novel code completion task"
    if category == "agentic_coding":
        return "Agentic Coding: SWE-Agent is used to try to resolve issues from Multi-SWE-Bench. The Multi-SWE-Bench evaluation harness is used to judge solutions"
    if category == "mathematics":
        return "Math: questions from high school math competitions from the past 12 months (AMC12, AIME, USAMO, IMO, SMC), as well as harder versions of AMPS questions"
    if category == "data_analysis":
        return "Data Analysis: three tasks, all of which use recent datasets from Kaggle and Socrata: table reformatting (among JSON, JSONL, Markdown, CSV, TSV, and HTML), predicting which columns can be used to join two tables, and predicting the correct type annotation of a data column"
    if category == "language":
        return "Language Comprehension: three tasks featuring Connections word puzzles, a typo removal task, and a movie synopsis unscrambling task from recent movies on IMDb and Wikipedia"
    if category == "if":
        return "Instruction Following: four tasks to paraphrase, simplify, summarize, or generate stories about recent new articles from The Guardian, subject to one or more instructions such as word limits or incorporating specific elements in the response"
    return default


def get_subcategory_description(category: str, task: str) -> str:
    if task == "AMPS_Hard":
        return "Harder versions of AMPS questions"
    if task == "math_comp":
        return "Math Competitions"
    if task == "olympiad":
        return "Math Olympiad"
    if task == "web_of_lies_v3":
        return "Web of Lies: Evaluate the truth value of complex logical statements"
    if task == "zebra_puzzle":
        return "Zebra Puzzles: Solve logical puzzles with multiple constraints"
    if task == "connections":
        return "Connections Word Puzzles: Group words based on hidden connections"
    if task == "typos":
        return "Typo Correction: Identify and correct misspellings in academic abstracts"
    if task == "tablereformat":
        return "Table Reformatting: Convert tables between different formats like JSON and CSV"
    if task == "tablejoin":
        return "Tasks requiring models to create valid joins between datasets"
    if task == "paraphrase":
        return "Paraphrasing: Rephrase articles while maintaining the original meaning"
    if task == "summarize":
        return "Summarization: Condense long articles into brief summaries"
    return f"{category}/{task}"


class LiveBenchScraper:
    """Scraper to fetch data directly from livebench.ai leaderboard."""

    def __init__(self):
        self.base_url = "https://livebench.ai"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        )
        self.browser = None
        self.page = None

    async def init_leaderboard_data_playwright(self) -> None:
        """Use Playwright to initialize dynamic leaderboard data."""
        print("Fetching LiveBench leaderboard data using Playwright...")

        playwright = await async_playwright().start()

        try:
            # Launch browser and keep it open
            self.browser = await playwright.chromium.launch(headless=True)
            self.page = await self.browser.new_page()

            # Navigate to the leaderboard
            print(f"Loading {self.base_url}...")
            await self.page.goto(self.base_url, wait_until="networkidle", timeout=30000)

            # Wait for the page to load and JavaScript to execute
            print("Waiting for page to load...")
            await self.page.wait_for_timeout(5000)

            # Try to find leaderboard metadata
            await self._extract_leaderboard_metadata()

        except Exception as e:
            print(f"Error fetching data: {e}")
            # Clean up on error
            if self.browser:
                await self.browser.close()
            raise

    async def close_browser(self):
        """Close the browser when done."""
        if self.browser:
            await self.browser.close()
            self.browser = None
            self.page = None

    async def _find_checkboxes(self) -> List[Dict]:
        """Enhanced checkbox finding with multiple strategies."""
        page = self.page
        checkboxes = []

        print("=== CHECKBOX DETECTION ===")

        # Get all checkbox inputs
        checkbox_inputs = await page.query_selector_all('input[type="checkbox"]')
        print(f"Found {len(checkbox_inputs)} checkbox inputs")

        # Get all checkbox label containers
        checkbox_labels = await page.query_selector_all('[class*="checkbox"]')
        print(f"Found {len(checkbox_labels)} checkbox label containers")

        # Extract all labels from the label containers
        all_labels = []
        for label_container in checkbox_labels:
            try:
                text = await label_container.inner_text()
                # Split by newlines and clean up
                lines = [line.strip() for line in text.split("\n") if line.strip()]
                all_labels.extend(lines)
            except Exception as e:
                print(f"Error extracting labels: {e}")

        # Process each checkbox input
        for i, checkbox_input in enumerate(checkbox_inputs):
            try:
                # Get checkbox state
                is_checked = await self._get_checkbox_state(checkbox_input)

                # Try to get label using standard methods first
                label_text = await self._get_checkbox_label(checkbox_input)

                # If label is "Unknown", try to match with extracted labels
                if label_text == "Unknown" and i < len(all_labels):
                    label_text = all_labels[i]

                checkbox_info = {
                    "element": checkbox_input,
                    "selector": 'input[type="checkbox"]',
                    "label": label_text,
                    "checked": is_checked,
                    "index": i,
                }
                checkboxes.append(checkbox_info)
                print(f"  [{i}] {label_text} (checked: {is_checked})")

            except Exception as e:
                print(f"  Error processing checkbox {i}: {e}")

        return checkboxes

    async def _get_checkbox_state(self, element) -> bool:
        """Get checkbox state."""
        try:
            if hasattr(element, "is_checked"):
                return await element.is_checked()

            return False

        except Exception as e:
            print(f"Error getting checkbox state: {e}")
            return False

    async def _get_checkbox_label(self, element) -> str:
        """Get checkbox label using associated label element."""
        page = self.page
        try:
            element_id = await element.get_attribute("id")
            if element_id:
                label_element = await page.query_selector(f'label[for="{element_id}"]')
                if label_element:
                    label_text = await label_element.inner_text()
                    if label_text:
                        return label_text.strip()
            return "Unknown"

        except Exception as e:
            print(f"Error getting checkbox label: {e}")
            return "Error"

    async def _extract_leaderboard_metadata(self) -> None:
        """Extract leaderboard metadata from the page."""
        page = self.page

        self.livebench_version = await self._extract_version()

        self.checkboxes = await self._find_checkboxes()

    async def _extract_version(self) -> str:
        """Extract LiveBench version from the page."""
        page = self.page
        print("Looking for LiveBench version...")

        # Get page content to search for version patterns
        content = await page.content()

        # Common version patterns
        version_patterns = [
            r"LiveBench[- ](\d{4}-\d{2}-\d{2})",
            r"livebench[- ](\d{4}-\d{2}-\d{2})",
            r"version[:\s]*(\d{4}-\d{2}-\d{2})",
            r"release[:\s]*(\d{4}-\d{2}-\d{2})",
            r"(\d{4}-\d{2}-\d{2})",  # Any date pattern
        ]

        for pattern in version_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                # Get the most recent date (assuming they use dates for versions)
                dates = sorted(matches, reverse=True)
                version = f"LiveBench-{dates[0]}"
                print(f"Found version: {version}")
                return version

        # Default to current expected version if not found
        default_version = "LiveBench-2025-05-30"
        print(f"Version not found, defaulting to: {default_version}")
        return default_version

    async def extract_table_data(self, check_checkboxes: List[int] = []) -> List[Dict]:
        """Extract data from HTML page."""
        if not self.page:
            raise RuntimeError("Page not initialized. Call init_leaderboard_data_playwright first.")

        # Check specified checkboxes if provided
        if check_checkboxes:
            await self._update_checkboxes(check_checkboxes)

        page = self.page
        tables = await page.query_selector_all("table")

        if not tables:
            print("No tables found on the page")
            return []

        table = tables[0]

        rows = await table.query_selector_all("tr")
        if not rows:
            return []

        # Get headers
        header_row = rows[0]
        headers = []
        header_cells = await header_row.query_selector_all("th, td")
        for cell in header_cells:
            text = await cell.inner_text()
            headers.append(text.strip())

        # Get data rows
        data = []
        for row in rows[1:]:
            cells = await row.query_selector_all("td, th")
            if len(cells) >= len(headers):
                row_data = {}
                for i, cell in enumerate(cells[: len(headers)]):
                    text = await cell.inner_text()
                    row_data[headers[i]] = text.strip()
                data.append(row_data)

        return data

    async def _update_checkboxes(self, check_indices: List[int]) -> None:
        """Update checkbox states based on provided indices."""
        if not hasattr(self, "checkboxes") or not self.checkboxes:
            print("Warning: No checkboxes found. Cannot update checkbox states.")
            return

        print(f"Updating checkboxes: {check_indices}")

        for i in check_indices:
            checkbox_info = self.checkboxes[i]
            try:
                element = checkbox_info["element"]
                await element.click()
                await self.page.wait_for_timeout(500)

            except Exception as e:
                print(f"  Error updating checkbox {i}: {e}")

        # Wait for any dynamic content to update after checkbox changes
        print("Waiting for page to update after checkbox changes...")
        await self.page.wait_for_timeout(2000)

    async def convert_to_canonical_format(self, output_dir: Path) -> int:
        """Convert scraped data to canonical format."""
        models_data = await self.extract_table_data()

        if not models_data:
            print("Could not find models data in scraped content")
            return 0

        n = len(models_data)

        print(f"Found {n} models")

        metric_metadata = {
            "benchmark": "livebench",
            "benchmark_version": self.livebench_version,
            "source": "livebench.ai",
            "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        }

        entries = []

        for model_data in models_data:
            if not isinstance(model_data, dict):
                continue

            # Extract model information
            model_name = model_data.pop("Model", "")
            organization = model_data.pop("Organization", "")
            if not model_name:
                continue

            # Create metadata
            metadata = {
                "model": model_name,
                "organization": organization,
            }

            # Extract scores
            metrics = {}

            for key, value in model_data.items():
                if not isinstance(key, str):
                    continue
                try:
                    metric = metric_metadata.copy()
                    metric["value"] = float(value)
                    if key == "Global Average":
                        metric["description"] = "LiveBench Global Average"
                        metrics["livebench/average"] = metric
                        continue
                    category = get_category_from_label(key)
                    metric["description"] = get_category_description(category, key)
                    metrics[f"livebench/categories/{category}"] = metric
                except:
                    continue

            entries.append({"metadata": metadata, "metrics": metrics})

        await self._fetch_model_api_names(entries)
        for i, checkbox in enumerate(self.checkboxes):
            if not checkbox.get("label", "").endswith(" Average"):
                continue
            if i + 1 == len(self.checkboxes):
                break
            if self.checkboxes[i + 1].get("label", "") != "Show Subcategories":
                continue
            await self._fetch_subcategories(entries, checkbox.get("label", ""), [i + 1], metric_metadata)

        for entry in entries:
            model_name = entry["metadata"]["model"]
            # Create entry directory
            safe_model_name = model_name.replace("/", "_").replace(":", "_").replace(".", "_").replace("-", "_")
            entry_dir = output_dir / f"livebench_web_{safe_model_name}"
            entry_dir.mkdir(parents=True, exist_ok=True)

            # Create canonical format
            output_data = {
                "metadata": dict(sorted(entry["metadata"].items())),
                "metrics": dict(sorted(entry["metrics"].items())),
            }

            # Write metrics.json
            metrics_file = entry_dir / "metrics.json"
            with open(metrics_file, "w") as f:
                json.dump(output_data, f, indent=2)

            print(f"Created entry: {entry_dir}")

        return len(entries)

    async def _fetch_model_api_names(self, entries: List[Dict[str, Any]]) -> None:
        # Find the checkbox for "Show API Name"
        show_api_checkbox_index = None
        for i, checkbox in enumerate(self.checkboxes):
            if checkbox.get("label", "") == "Show API Name":
                show_api_checkbox_index = i
                break

        if show_api_checkbox_index is None:
            print("ERROR: Could not find 'Show API Name' checkbox")
            return

        models_data = await self.extract_table_data(check_checkboxes=[show_api_checkbox_index])

        n = len(models_data)
        if n != len(entries):
            print("ERROR: Could not fetch the same number of entries when fetching model api names")
            return

        for entry, model_data in zip(entries, models_data):
            entry["metadata"]["model_api_name"] = model_data.get("Model", "")

    async def _fetch_subcategories(
        self,
        entries: List[Dict[str, Any]],
        category_label: str,
        check_checkboxes: List[int],
        metric_metadata: Dict[str, Any],
    ) -> None:
        models_data = await self.extract_table_data(check_checkboxes=check_checkboxes)

        if not models_data:
            print(f"ERROR: Could not fetch entries when fetching subcategories for {category_label}")
            return

        entries_index: Dict[str, int] = {}
        for i, entry in enumerate(entries):
            entries_index[entry["metadata"]["model_api_name"]] = i

        for model_data in models_data:
            model_name = model_data.pop("Model", "")
            model_data.pop("Organization", "")
            if model_data.pop(category_label, "") == "":
                print("ERROR: could not find category average score when fetching subcategories")
                return

            entry_index = entries_index.get(model_name)
            if entry_index == None:
                continue
            entry = entries[entry_index]

            category = get_category_from_label(category_label)

            for key, value in model_data.items():
                if not isinstance(key, str):
                    continue
                try:
                    metric = metric_metadata.copy()
                    metric["value"] = float(value)
                    metric["description"] = get_subcategory_description(category, key)
                    entry["metrics"][f"livebench/subcategories/{category}/{key}"] = metric
                except:
                    continue


async def main():
    """Main function to scrape LiveBench leaderboard."""
    # Create output directory
    output_dir = Path("~/.analytics/livebench/leaderboard").expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Output directory: {output_dir}")

    # Initialize scraper
    scraper = LiveBenchScraper()

    try:
        await scraper.init_leaderboard_data_playwright()

        entries_created = await scraper.convert_to_canonical_format(output_dir)
        print(f"\n{'=' * 60}")
        print(f"SUCCESS: Created {entries_created} LiveBench entries from web scraping")
        print(f"{'=' * 60}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()

    finally:
        # Always close the browser
        await scraper.close_browser()

    print(f"\nCompleted! Check {output_dir} for results.")


def run_sync():
    """Synchronous wrapper for the async main function."""
    asyncio.run(main())


if __name__ == "__main__":
    run_sync()

# Karlsruhe OParl Syndication

This project provides syndication for Karlsruhe's OParl data, making it easier to access and monitor city council agenda items.

## Atom Feed

The latest agenda items are available as an Atom feed at the following URL:

[https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte.xml](https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte.xml)

You can use this feed URL in any feed reader to stay updated on the latest agenda items from Karlsruhe's city council meetings.

## About the Project

This project fetches data from Karlsruhe's OParl API, processes it, and generates an Atom feed. It's designed to make it easier for citizens, journalists, and other interested parties to keep track of city council activities.

## Usage

To use this feed:

1. Copy the feed URL: `https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte.xml`
2. Paste this URL into your preferred feed reader or RSS aggregator.
3. Your feed reader will now periodically check for updates and display new agenda items as they become available.

## Contributing

Contributions to improve this project are welcome. Please feel free to submit issues or pull requests on the GitHub repository.

## Development Notes

### File Content Storage

This project extracts and stores text content from PDF files. To avoid exceeding GitHub's file size limits (100MB) and provide efficient access options, the extracted text is stored in two complementary formats:

#### Individual Files (for Direct Access)
1. `docs/file-contents.json` - Contains metadata about all files (without the extracted text)
2. `docs/file-contents/` - Directory containing individual plain text files for each extracted file, using the last part of the file ID as the filename with a .txt extension

The plain text format makes it easy for other applications to access specific content directly via HTTP requests.

#### Chunk Files (for Bulk Loading)
1. `docs/file-contents-chunks/` - Directory containing JSON chunk files, each with multiple file contents bundled together

The chunk files provide a more efficient way to download multiple file contents at once, reducing the number of HTTP requests needed for bulk operations.

#### How It Works

All files, including both individual text files and chunk files, are included in Git. When you clone this repository and run the application, it will:

1. Load the metadata from the index file
2. Try to load content from chunk files first (faster for bulk loading)
3. Fall back to loading from individual text files if needed
4. Create or update both individual text files and chunk files when new content is processed

This dual approach ensures that all data is available immediately after cloning the repository, while still keeping individual file sizes under GitHub's 100MB limit. It also provides flexibility in how the data is accessed:

- For single file access: Use the individual text files
- For bulk operations: Use the chunk files to reduce download time

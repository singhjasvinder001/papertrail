# PaperTrail — Getting Started Guide

Welcome to PaperTrail. This guide explains how the platform works and how to get the most out of your collections.

## Creating a collection

Collections are the top-level containers in PaperTrail. Each collection keeps a set of related documents together and has its own search index. To create one, open the dashboard and click "New collection", then give it a name and an optional description.

## Uploading documents

PaperTrail accepts PDF, plain text, markdown, CSV, JSON, PNG, JPEG and WebP files, up to 25 megabytes each. You can drag and drop multiple files at once. After the upload finishes, a worker picks up the job from the queue and starts processing.

## The processing pipeline

Every document goes through four stages, visible live in the UI:

1. Queued — the file was uploaded and the job is waiting in the Valkey queue.
2. Processing — the worker downloads the original from object storage and extracts text. PDFs are read with pdf.js; images are OCRed with tesseract.js.
3. Indexing — the extracted text is split into overlapping fragments and sent to Meilisearch.
4. Ready — the document is searchable and answers questions.

If a stage fails, the document is marked as failed with the error message shown in the list, and the job is retried up to three times.

## Searching and asking

Open the Search tab and type any query. Meilisearch tolerates typos and returns the most relevant fragments with the source page highlighted.

The Ask tab turns the same index into a question-answering surface: the API retrieves the six most relevant fragments and either summarizes them with a configured LLM or returns an extractive, fully traceable answer. Every answer cites the source document and page, so nothing is ever fabricated.

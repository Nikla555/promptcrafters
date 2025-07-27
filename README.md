# Prompt Crafters

AI prompt engineering and testing workflow for generating consistent, high-quality images.

## Team & Workflow

- **Watson**: Creates and manages prompts in `/prompts/`
- **Frank**: Tests prompts and evaluates results using `/scripts/`
- **Niklas**: Builds website in `/website/`

## Quick Start

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run the testing script
cd scripts
deno task dev
```

This processes all prompts and generates 9 test variations each (63 total images).

## Directory Structure

```
promptcrafters/
├── prompts/           # Watson's domain - prompt templates
├── results/           # Frank's domain - organized test outputs  
├── scripts/           # Frank's domain - testing automation
├── website/           # Niklas's domain - web interface
└── chaos/             # Random files and experiments
```

## Prompt Templates

All prompts use the `[SUBJECT]` placeholder and are tested with 9 different subjects:
`snake`, `computer`, `house`, `tree`, `robot`, `flower`, `mountain`, `bicycle`, `cat`

## Requirements

- [Deno](https://deno.land/) 2.x
- OpenAI API key with image generation access
- Internet connection for API calls

## Results

Generated images are organized by prompt style:
```
results/
├── kawaii-blob-characters/
├── analytical-cubist-style/
├── cinematic-flowing-ribbons/
└── ...
```

Each folder contains 9 variations with timestamps for easy comparison and evaluation.

---

**Website**: [promptcrafters.surge.sh](https://promptcrafters.surge.sh)

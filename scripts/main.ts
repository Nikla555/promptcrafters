import OpenAI from "@openai/openai";
import { join, resolve } from "jsr:@std/path";
import { ensureDir } from "jsr:@std/fs";

interface GeneratedImage {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

class PicassoImageGenerator {
  private openai: OpenAI;
  private subjects = ["snake", "computer", "house", "tree", "robot", "flower", "mountain", "bicycle", "cat"];
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || Deno.env.get("OPENAI_API_KEY"),
    });
  }

  async readPromptTemplate(filePath: string): Promise<string> {
    try {
      const content = await Deno.readTextFile(filePath);
      return content.trim();
    } catch (error) {
      console.error(`[ERROR] Error reading prompt template: ${(error as Error).message}`);
      throw error;
    }
  }

  async generateImage(prompt: string, subject: string): Promise<GeneratedImage> {
    try {
      console.log(`[ART] Generating cubist ${subject}...`);
      
      const response = await this.openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      });
      
      if (!response.data || response.data.length === 0) {
        throw new Error("No image data received from OpenAI");
      }

      const imageData = response.data[0];
      console.log(`[OK] ${subject} generated successfully`);
      console.log(`[DEBUG] Image format: ${imageData.url ? 'URL' : imageData.b64_json ? 'base64' : 'unknown'}`);
      
      if (imageData.revised_prompt) {
        console.log(`[NOTE] Revised prompt: ${imageData.revised_prompt.substring(0, 100)}...`);
      }

      return imageData;
    } catch (error) {
      console.error(`[ERROR] Error generating ${subject}: ${(error as Error).message}`);
      throw error;
    }
  }

  async saveImage(imageData: GeneratedImage, subject: string, promptName: string): Promise<void> {
    try {
      const outputDir = join(Deno.cwd(), "..", "results", promptName);
      await ensureDir(outputDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `cubist_${subject}_${timestamp}.png`;
      const fullPath = join(outputDir, filename);
      
      let uint8Array: Uint8Array;
      
      if (imageData.url) {
        // Handle URL format (DALL-E 3)
        console.log(`[DEBUG] Downloading from URL: ${imageData.url.substring(0, 50)}...`);
        const response = await fetch(imageData.url);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        uint8Array = new Uint8Array(arrayBuffer);
        
      } else if (imageData.b64_json) {
        // Handle base64 format (gpt-image-1)
        console.log(`[DEBUG] Processing base64 image data (${imageData.b64_json.length} chars)`);
        const binaryString = atob(imageData.b64_json);
        uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        
      } else {
        throw new Error("No image data received (neither URL nor base64)");
      }
      
      await Deno.writeFile(fullPath, uint8Array);
      console.log(`[SAVED] Saved as: ${fullPath}`);
    } catch (error) {
      console.error(`[ERROR] Error saving image: ${(error as Error).message}`);
      throw error;
    }
  }

  async getPromptFiles(): Promise<string[]> {
    try {
      const promptsDir = join(Deno.cwd(), "..", "prompts");
      const promptFiles: string[] = [];
      for await (const dirEntry of Deno.readDir(promptsDir)) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".txt")) {
          promptFiles.push(dirEntry.name);
        }
      }
      return promptFiles.sort();
    } catch (error) {
      console.error(`[ERROR] Error reading prompts directory: ${(error as Error).message}`);
      throw error;
    }
  }

  async generateVariationsForPrompt(promptFileName: string): Promise<void> {
    const promptName = promptFileName.replace(".txt", "");
    const promptPath = join(Deno.cwd(), "..", "prompts", promptFileName);
    
    console.log(`\n[PROMPT] Processing: ${promptFileName}`);
    console.log("-" .repeat(50));
    
    const promptTemplate = await this.readPromptTemplate(promptPath);
    console.log(`[LOADED] Template loaded for ${promptName}`);
    console.log(`[START] Generating 9 variations with subjects: ${this.subjects.join(", ")}`);
    console.log(`[PARALLEL] Starting concurrent generation of all 9 images...\n`);
    
    // Create promises for all 9 image generations
    const generationPromises = this.subjects.map(async (subject, index) => {
      try {
        console.log(`[${index + 1}/9] Starting ${subject.toUpperCase()}...`);
        const prompt = promptTemplate.replace("[SUBJECT]", subject);
        const imageData = await this.generateImage(prompt, subject);
        await this.saveImage(imageData, subject, promptName);
        console.log(`[${index + 1}/9] ✅ ${subject.toUpperCase()} completed`);
        return { success: true, subject };
      } catch (error) {
        console.error(`[${index + 1}/9] ❌ ${subject.toUpperCase()} failed: ${(error as Error).message}`);
        return { success: false, subject, error: (error as Error).message };
      }
    });
    
    // Wait for all generations to complete
    const results = await Promise.allSettled(generationPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    console.log(`\n[BATCH] Completed batch processing for ${promptName}`);
    console.log(`[STATS] ✅ ${successful} successful, ❌ ${failed} failed`);
    
    if (failed > 0) {
      console.log(`[RETRY] Failed subjects: ${results
        .filter((r): r is PromiseFulfilledResult<{success: boolean, subject: string, error?: string}> => r.status === 'fulfilled' && !r.value.success)
        .map(r => r.value.subject)
        .join(", ")}`);
    }
  }

  async generateAllVariations(): Promise<void> {
    console.log("[DENO] Picasso Cubist Art Generator");
    console.log("=" .repeat(50));
    
    const promptFiles = await this.getPromptFiles();
    
    if (promptFiles.length === 0) {
      console.log("[ERROR] No .txt files found in prompts/ directory");
      return;
    }
    
    console.log(`[INFO] Found ${promptFiles.length} prompt file(s): ${promptFiles.join(", ")}`);
    console.log(`[PARALLEL] Each prompt will generate 9 images concurrently\n`);
    
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < promptFiles.length; i++) {
      const promptFile = promptFiles[i];
      try {
        console.log(`[BATCH ${i + 1}/${promptFiles.length}] Processing prompt file...`);
        await this.generateVariationsForPrompt(promptFile);
        
        if (i < promptFiles.length - 1) {
          console.log("\n[COOLDOWN] Waiting 10 seconds before next prompt batch...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (error) {
        console.error(`[ERROR] Failed to process ${promptFile}: ${(error as Error).message}`);
        totalFailed += 9; // Assume all 9 failed for this prompt
        continue;
      }
    }
    
    const expectedTotal = promptFiles.length * 9;
    console.log(`\n[FINAL] Completed processing all ${promptFiles.length} prompt files!`);
    console.log(`[SUMMARY] Expected: ${expectedTotal} images (${promptFiles.length} prompts × 9 variations each)`);
    console.log(`[INFO] Check the ../results/ directory for organized results`);
  }
}

async function main() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[ERROR] OPENAI_API_KEY environment variable is required");
    console.log("[TIP] Set it with: export OPENAI_API_KEY='your-api-key-here'");
    Deno.exit(1);
  }

  try {
    const generator = new PicassoImageGenerator(apiKey);
    await generator.generateAllVariations();
  } catch (error) {
    console.error(`[FATAL] Fatal error: ${(error as Error).message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
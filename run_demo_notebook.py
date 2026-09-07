"""
Execute 01_YouTube_Chatbot_System_Demo.ipynb using the registered 'youtube-chatbot-venv' kernel
and save all outputs and visualizations inplace and to notebooks/.
"""
import sys
import shutil
import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

def run_notebook():
    notebook_path = "01_YouTube_Chatbot_System_Demo.ipynb"
    print(f"Reading {notebook_path}...")
    with open(notebook_path, "r", encoding="utf-8") as f:
        nb = nbformat.read(f, as_version=4)

    # Set kernel metadata
    nb.metadata["kernelspec"] = {
        "name": "youtube-chatbot-venv",
        "display_name": "Python (YouTube Chatbot Venv)",
        "language": "python"
    }

    print("Executing notebook using kernel 'youtube-chatbot-venv'...")
    ep = ExecutePreprocessor(timeout=300, kernel_name="youtube-chatbot-venv")
    ep.preprocess(nb, {"metadata": {"path": "."}})
    print("Execution completed successfully!")

    # Verify outputs
    code_cells = [c for c in nb.cells if c.cell_type == "code"]
    output_count = sum(len(c.outputs) for c in code_cells)
    print(f"Total code cells: {len(code_cells)}, Total outputs captured: {output_count}")

    # Write back inplace
    with open(notebook_path, "w", encoding="utf-8") as f:
        nbformat.write(nb, f)
    print(f"Updated {notebook_path} with execution outputs.")

    # Also copy to notebooks/
    dest_path = "notebooks/01_YouTube_Chatbot_System_Demo.ipynb"
    shutil.copyfile(notebook_path, dest_path)
    print(f"Copied executed notebook to {dest_path}.")

if __name__ == "__main__":
    try:
        run_notebook()
    except Exception as e:
        print(f"Error executing notebook: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

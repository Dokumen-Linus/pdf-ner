import os

from pypdf import PdfReader, PdfWriter


def extract_first_page(input_path):
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()

        if len(reader.pages) > 0:
            # Add the first page
            writer.add_page(reader.pages[0])

            # Transfer metadata
            if reader.metadata:
                writer.add_metadata(reader.metadata)

            # Construct output filename
            base_name = os.path.basename(input_path)
            name, ext = os.path.splitext(base_name)
            output_path = f"{name}_first_page{ext}"

            with open(output_path, "wb") as output_file:
                writer.write(output_file)

            print(f"Successfully created: {output_path}")
        else:
            print(f"Skipping {input_path}: PDF is empty.")

    except Exception as e:
        print(f"Error processing {input_path}: {e}")


def main():
    # List of specific PDFs to process
    pdf_files = ["2025-19982.pdf", "2025-21665.pdf", "2025-21767.pdf"]

    # Get the directory of the script
    script_dir = os.path.dirname(os.path.abspath(__file__))

    for pdf_file in pdf_files:
        file_path = os.path.join(script_dir, pdf_file)
        if os.path.exists(file_path):
            extract_first_page(file_path)
        else:
            print(f"File not found: {file_path}")


if __name__ == "__main__":
    main()

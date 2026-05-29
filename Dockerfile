FROM python:3.10-slim

# Set the working directory
WORKDIR /code

# Copy the requirements file into the container
COPY ./requirements.txt /code/requirements.txt

# Install the dependencies
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Create a non-root user that Hugging Face expects (user ID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

# Change working directory to the user's home
WORKDIR $HOME/app

# Copy the rest of the application code with proper ownership
COPY --chown=user . $HOME/app

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Run the application using Gunicorn for production
CMD ["gunicorn", "-b", "0.0.0.0:7860", "app:app", "--timeout", "120", "--workers", "2", "--threads", "4"]

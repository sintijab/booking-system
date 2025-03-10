# Use the official PostgreSQL image from the Docker Hub
FROM postgres:16

# Add the init.sql script to the Docker image
COPY 01-init.sql /docker-entrypoint-initdb.d/
COPY 02-availability_view.sql /docker-entrypoint-initdb.d/

# Set environment variables for PostgreSQL
ENV POSTGRES_DB=coding-challenge
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=mypassword123!

# To build and run this container run the following commands

# docker build -t appointment-db .
# docker run --name appointment-db -p 5433:5432 -d appointment-db

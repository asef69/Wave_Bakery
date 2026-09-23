import os
import tempfile

# Ensure WK_DATABASE_URL is set before any app modules are imported
temp_db_path = os.path.join(tempfile.mkdtemp(), 'test_wavekitchen.db')
os.environ['WK_DATABASE_URL'] = f'sqlite:///{temp_db_path}'

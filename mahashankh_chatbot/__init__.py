# PyMySQL pretends to be MySQLdb (pure-Python MySQL driver, no system deps).
try:
    import pymysql

    pymysql.install_as_MySQLdb()
    pymysql.version_info = (1, 4, 6, "final", 0)  # satisfy Django's mysqlclient check
except ImportError:
    pass

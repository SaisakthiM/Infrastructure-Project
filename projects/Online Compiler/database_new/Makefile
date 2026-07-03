CXX      = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -g
LDFLAGS  = -lpthread
TARGET   = dbserver
SRC      = src/main.cpp

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SRC) $(LDFLAGS)

clean:
	rm -f $(TARGET)
